import * as BABYLON from "babylonjs";
import { useEffect, useRef } from "react";
import { v4 as uuid } from "uuid";

const useBremner = () => {
  const pvl = (p, t) => {
    const vl = t.subtract(p);
    const l = vl.length();
    const v = vl.scale(1 / l);
    return { p, v, l };
  };
};

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
    camera.setPosition(new BABYLON.Vector3(2, 0.5, 2));
    camera.attachControl(canvas, true);

    scene.ambientColor = new BABYLON.Color3(1, 1, 1);

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

    const xy = BABYLON.MeshBuilder.CreatePlane(
      "XY",
      { size: 1, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
      scene
    );
    xy.position.x = 0.5;
    xy.position.y = 0.5;

    const zy = xy.clone("ZY");
    zy.rotate(BABYLON.Axis.Y, Math.PI / 2, BABYLON.Space.WORLD);
    zy.translate(BABYLON.Axis.X, -0.5, BABYLON.Space.WORLD);
    zy.translate(BABYLON.Axis.Z, 0.5, BABYLON.Space.WORLD);

    const xz = xy.clone("XZ");
    xz.rotate(BABYLON.Axis.X, Math.PI / 2, BABYLON.Space.WORLD);
    xz.translate(BABYLON.Axis.Y, -0.5, BABYLON.Space.WORLD);
    xz.translate(BABYLON.Axis.Z, 0.5, BABYLON.Space.WORLD);

    const colorMat = (r, g, b) => {
      const mat = new BABYLON.StandardMaterial(`mat-${r}-${g}-${b}`, scene);
      mat.ambientColor = new BABYLON.Color3(r, g, b);
      mat.alpha = 0.65;
      return mat;
    };

    xy.material = colorMat(1, 0, 0);
    zy.material = colorMat(0, 1, 0);
    xz.material = colorMat(0.5, 0.5, 0.5);

    let pState = "idle";
    let pTarget = null;
    let pFrom = null;
    let pTo = null;
    let segs = { [xy.name]: {}, [zy.name]: {} };

    scene.onPointerObservable.add((pointerInfo) => {
      if (
        pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN &&
        pointerInfo.pickInfo.hit &&
        pState === "idle" &&
        [xy, zy].includes(pointerInfo.pickInfo.pickedMesh)
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
          const name = uuid();
          const seg = BABYLON.MeshBuilder.CreateTube(
            name,
            { path: [pFrom, pTo], radius: 0.01, cap: BABYLON.Mesh.CAP_ALL },
            scene
          );
          seg.material = pTarget.material;
          segs[pTarget.name][name] = [pFrom, pTo];
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
        pState === "idle" &&
        pointerInfo.pickInfo.pickedMesh
      ) {
        const mesh = pointerInfo.pickInfo.pickedMesh;
        [xy, zy].forEach((plane) => {
          if (mesh.name in segs[plane.name]) {
            delete segs[plane.name][mesh.name];
            mesh.dispose();
          }
        });
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
