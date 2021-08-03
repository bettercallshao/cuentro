import * as BABYLON from "babylonjs";
import { useEffect, useRef } from "react";

const usePreview = () => {
  const init = (ref) => {
    const canvas = ref.current;
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);

    const camera = new BABYLON.ArcRotateCamera(
      "camera0",
      0,
      0,
      3,
      new BABYLON.Vector3(0.5, 0.5, 0.5),
      scene
    );
    camera.wheelPrecision = 100;
    camera.attachControl(canvas, true);

    scene.ambientColor = new BABYLON.Color3(0.5, 0.5, 0.5);

    // const zLight = new BABYLON.HemisphericLight(
    //   "light",
    //   new BABYLON.Vector3(0, 0, 1),
    //   scene
    // );
    // zLight.intensity = 0.1;
    // const xLight = new BABYLON.HemisphericLight(
    //   "light",
    //   new BABYLON.Vector3(1, 0, 0),
    //   scene
    // );
    // xLight.intensity = 0.1;
    //
    // const obj = BABYLON.MeshBuilder.CreateSphere(
    //   "obj",
    //   { diameter: 0.1 },
    //   scene
    // );
    // obj.position.x = 0.5;
    // obj.position.y = 0.5;
    // obj.position.z = 0.5;

    const front = BABYLON.MeshBuilder.CreatePlane(
      "front",
      { size: 1, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
      scene
    );
    front.position.x = 0.5;
    front.position.y = 0.5;

    const right = front.clone("right");
    right.rotate(BABYLON.Axis.Y, Math.PI / 2, BABYLON.Space.WORLD);
    right.translate(BABYLON.Axis.X, -0.5, BABYLON.Space.WORLD);
    right.translate(BABYLON.Axis.Z, 0.5, BABYLON.Space.WORLD);

    const bottom = front.clone("bottom");
    bottom.rotate(BABYLON.Axis.X, Math.PI / 2, BABYLON.Space.WORLD);
    bottom.translate(BABYLON.Axis.Y, -0.5, BABYLON.Space.WORLD);
    bottom.translate(BABYLON.Axis.Z, 0.5, BABYLON.Space.WORLD);

    const colorMat = (r, g, b) => {
      const mat = new BABYLON.StandardMaterial(`mat-${r}-${g}-${b}`, scene);
      mat.ambientColor = new BABYLON.Color3(r, g, b);
      mat.alpha = 0.65;
      return mat;
    };

    front.material = colorMat(0, 0, 1);
    right.material = colorMat(0, 1, 0);
    bottom.material = colorMat(0.5, 0.5, 0.5);

    let pState = "idle";
    let pTarget = null;
    let pFrom = null;
    let pTo = null;
    let segs = [];

    scene.onPointerObservable.add((pointerInfo) => {
      if (
        pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN &&
        pointerInfo.pickInfo.hit &&
        pState === "idle" &&
        [front, right].includes(pointerInfo.pickInfo.pickedMesh)
      ) {
        pState = "active";
        pTarget = pointerInfo.pickInfo.pickedMesh;
        pFrom = pointerInfo.pickInfo.pickedPoint;
        pTo = null;
        setTimeout(function () {
          camera.detachControl(canvas);
        }, 0);
      } else if (
        pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP &&
        pState === "active"
      ) {
        if (pTo) {
          let seg = BABYLON.MeshBuilder.CreateTube(
            pTarget.id + ".line",
            { path: [pFrom, pTo], radius: 0.01, cap: BABYLON.Mesh.CAP_ALL },
            scene
          );
          seg.material = pTarget.material;
          segs.push(seg);
        }
        pState = "idle";
        pTarget = null;
        camera.attachControl(canvas, true);
      } else if (
        pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE &&
        pState === "active"
      ) {
        let pickInfo = scene.pick(
          scene.pointerX,
          scene.pointerY,
          function (mesh) {
            return mesh === pTarget;
          }
        );
        if (pickInfo.hit) {
          pTo = pickInfo.pickedPoint;
        }
      } else if (
        pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN &&
        segs.includes(pointerInfo.pickInfo.pickedMesh)
      ) {
        const index = segs.indexOf(pointerInfo.pickInfo.pickedMesh);
        segs.splice(index, 1);
        pointerInfo.pickInfo.pickedMesh.dispose();
      }
    });

    engine.runRenderLoop(() => {
      scene.render();
    });
  };

  return [init];
};

function App() {
  const canvas = useRef(null);

  const [init] = usePreview();

  useEffect(() => {
    if (!canvas) return;
    init(canvas);
  }, [canvas, init]);

  return (
    <div className>
      <canvas ref={canvas} />
    </div>
  );
}

export default App;
