import { useEffect } from "preact/hooks";

const NUM_VIDEOS = 25;
const VIDEOS_PER_ROW = 5;
const TEXT_WIDTH = 320;
const TEXT_HEIGHT = 240;
const TEXT_TOTAL_WIDTH = TEXT_WIDTH * VIDEOS_PER_ROW;
const TEXT_TOTAL_HEIGHT = TEXT_HEIGHT * VIDEOS_PER_ROW;

const vertWgsl = `
struct OurVertexShaderOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

@vertex fn main(
  @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
  let pos = array(
    vec2( 1.0,  1.0),
    vec2( 1.0, -1.0),
    vec2(-1.0, -1.0),
    vec2( 1.0,  1.0),
    vec2(-1.0, -1.0),
    vec2(-1.0,  1.0),
  );

  const uv = array(
    vec2(1.0, 0.0),
    vec2(1.0, 1.0),
    vec2(0.0, 1.0),
    vec2(1.0, 0.0),
    vec2(0.0, 1.0),
    vec2(0.0, 0.0),
  );

  var vsOutput: OurVertexShaderOutput;
  let xy = pos[vertexIndex];
  vsOutput.position = vec4f(xy, 0.0, 1.0);
  vsOutput.texcoord = uv[vertexIndex];
  return vsOutput;
}
`;

const fragWgsl = `
@group(0) @binding(0) var ourSampler: sampler;
@group(0) @binding(1) var ourTexture: texture_2d<f32>;
struct OurVertexShaderOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

@fragment fn main(fsInput: OurVertexShaderOutput) -> @location(0) vec4f {
  return textureSample(ourTexture, ourSampler, fsInput.texcoord);
  // return vec4f(1.0, 0.0, 0.0, 1.0);
}
`;

async function initWebgpu() {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const canvas = document.querySelector("canvas");
  if (!canvas) throw new Error("no canvas");
  const context = canvas.getContext("webgpu") as GPUCanvasContext;

  console.log(device);

  const devicePixelRatio = window.devicePixelRatio;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format: presentationFormat,
    alphaMode: "premultiplied",
  });

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({
        code: vertWgsl,
      }),
      entryPoint: "main",
    },
    fragment: {
      module: device.createShaderModule({
        code: fragWgsl,
      }),
      entryPoint: "main",
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
  });

  const texture = device.createTexture({
    size: [TEXT_TOTAL_WIDTH, TEXT_TOTAL_HEIGHT],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  console.log(texture);

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        view: undefined, // Assigned later

        clearValue: { r: 1, g: 0.5, b: 0.5, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };

  const sampler = device.createSampler({
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    magFilter: "linear",
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: texture.createView() },
    ],
  });

  const frame = () => {
    renderPassDescriptor.colorAttachments[0].view = context
      .getCurrentTexture()
      .createView();

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(6);
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { width: TEXT_WIDTH, height: TEXT_HEIGHT },
  });

  for (let i = 0; i < NUM_VIDEOS; i++) {
    const trackProcessor = new MediaStreamTrackProcessor({
      track: stream.getVideoTracks()[0],
    });
    const trackGenerator = new MediaStreamTrackGenerator({ kind: "video" });

    const grid = {
      x: i % VIDEOS_PER_ROW,
      y: Math.floor(i / VIDEOS_PER_ROW),
    };

    const transformer = new TransformStream({
      transform(videoFrame, controller) {
        device.queue.copyExternalImageToTexture(
          { source: videoFrame },
          {
            texture,
            origin: [
              grid.x * TEXT_WIDTH,
              grid.y * TEXT_HEIGHT,
            ],
          },
          [TEXT_WIDTH, TEXT_HEIGHT, 1],
        );

        controller.enqueue(videoFrame);
      },
    });

    trackProcessor.readable.pipeThrough(transformer).pipeTo(
      trackGenerator.writable,
    );
  }
}

async function main() {
  await initWebgpu();
}

export default function DemoWebGPU() {
  useEffect(() => {
    main();
  }, []);
  return (
    <div>
      <canvas width="640" height="480"></canvas>
    </div>
  );
}
