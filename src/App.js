import * as BABYLON from "babylonjs";
import { useCallback, useEffect, useRef } from "react";

const usePreview = () => {
  const init = useCallback((ref) => {
    const canvas = ref.current;
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);

    const camera = new BABYLON.FreeCamera(
      "camera0",
      new BABYLON.Vector3(0, 5, -10),
      scene
    );
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 0, 0), scene);
    BABYLON.MeshBuilder.CreateSphere(
      "sphere",
      { diameter: 2, segments: 4 },
      scene
    );

    engine.runRenderLoop(() => {
      scene.render();
    });
  });

  return [init];
};

function App() {
  const canvas = useRef(null);

  const [init] = usePreview();

  useEffect(() => {
    if (!canvas) return;

    console.log(canvas.current);

    init(canvas);
  }, [canvas, init]);

  return (
    <div className>
      <canvas ref={canvas} />
    </div>
  );
}

export default App;
