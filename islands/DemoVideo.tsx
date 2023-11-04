import { useEffect } from "preact/hooks";

const NUM_VIDEOS = 25;

async function main() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 320, height: 240 },
    audio: false,
  });

  for (let i = 0; i < NUM_VIDEOS; i++) {
    const video = document.getElementById(`video${i}`) as HTMLVideoElement;
    video.srcObject = stream;
  }
}

export default function DemoWebGPU() {
  useEffect(() => {
    main();
  }, []);
  const videoIds = [...Array(NUM_VIDEOS).keys()];
  return (
    <div>
      {videoIds.map((id) => <video autoPlay id={`video${id}`} />)}
    </div>
  );
}
