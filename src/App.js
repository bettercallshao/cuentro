import * as BABYLON from "babylonjs";
import * as GUI from "babylonjs-gui";
import { useEffect, useRef } from "react";
import { v4 as uuid } from "uuid";

const useBremner = () => {
  const pvl = (p, t) => {
    const vl = t.subtract(p);
    const l = vl.length();
    const v = vl.scale(1 / l);
    return { p, v, l };
  };

  const cutYState = (pvl0, p0) => {
    const l = (p0.y - pvl0.p.y) / pvl0.v.y;
    if (l < 0) {
      return "<";
    } else if (l > pvl0.l) {
      return ">";
    } else {
      return "=";
    }
  };

  const cutXy = (pvl0, p0) => {
    const l = (p0.y - pvl0.p.y) / pvl0.v.y;
    const t0 = pvl0.p.add(pvl0.v.scale(l));
    t0.z = p0.z;
    return t0;
  };

  const cutZy = (pvl0, p0) => {
    const l = (p0.y - pvl0.p.y) / pvl0.v.y;
    const t0 = pvl0.p.add(pvl0.v.scale(l));
    t0.x = p0.x;
    return t0;
  };

  const mergeXyZy = (xy0, xy1, zy0_, zy1_) => {
    const xy = pvl(xy0, xy1);
    let [zy0, zy1] = [zy0_, zy1_];
    let zy = pvl(zy0, zy1);

    // we cannot deal with vectors with no y gradient (horizontal bars)
    if (xy.v.y * zy.v.y === 0) {
      return [null, null];
    }

    let sXz0 = cutYState(xy, zy0);
    let sXz1 = cutYState(xy, zy1);

    // switch zy points so they are always orders
    if (sXz0 > sXz1) {
      [sXz0, zy0, sXz1, zy1] = [sXz1, zy1, sXz0, zy0];
    }
    const stateX = sXz0 + sXz1;
    zy = pvl(zy0, zy1);

    if (["<<", ">>"].includes(stateX)) {
      // the two bars missed
      return [null, null];
    } else if (["<>"].includes(stateX)) {
      // z bar is longer
      return [cutZy(zy, xy0), cutZy(zy, xy1)];
    } else if (["=="].includes(stateX)) {
      // x bar is longer
      return [cutXy(xy, zy0), cutXy(xy, zy1)];
    } else if (["<="].includes(stateX)) {
      // overlap
      return [cutXy(xy, zy1), cutZy(zy, xy0)];
    } else if (["=>"].includes(stateX)) {
      return [cutZy(zy, xy1), cutXy(xy, zy0)];
    } else {
      throw Error("bug");
    }
  };

  return [mergeXyZy];
};

const usePreview = () => {
  const [mergeXyZy] = useBremner();

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
    let button = null;
    const segs = { [xy.name]: {}, [zy.name]: {} };
    const merges = {};

    const merge = () => {
      const version = uuid();
      for (const xyName in segs[xy.name]) {
        for (const zyName in segs[zy.name]) {
          const name = `${xyName}+${zyName}`;
          if (merges[name]) {
            merges[name].version = version;
          } else {
            merges[name] = { version };
            const [xy0, xy1] = segs[xy.name][xyName];
            const [zy0, zy1] = segs[zy.name][zyName];
            const [p0, p1] = mergeXyZy(xy0, xy1, zy0, zy1);
            if (p0) {
              const mesh = BABYLON.MeshBuilder.CreateTube(
                name,
                { path: [p0, p1], radius: 0.01, cap: BABYLON.Mesh.CAP_ALL },
                scene
              );
              mesh.material = xz.material;
              merges[name].mesh = mesh;
            }
          }
        }
      }
      // remove stale meshes
      for (const name in merges) {
        if (merges[name].version !== version) {
          if (merges[name].mesh) {
            merges[name].mesh.dispose();
          }
          delete merges[name];
        }
      }
    };

    scene.onPointerObservable.add((pointerInfo) => {
      if (
        pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN &&
        pointerInfo.pickInfo.hit &&
        pState === "idle" &&
        [xy, zy].includes(pointerInfo.pickInfo.pickedMesh)
      ) {
        if (
          button === "sequence" &&
          pTarget === pointerInfo.pickInfo.pickedMesh &&
          pTo
        ) {
          pFrom = pTo;
          pTo = pointerInfo.pickInfo.pickedPoint;
        } else {
          pFrom = pointerInfo.pickInfo.pickedPoint;
          pTo = null;
        }
        pState = "active";
        pTarget = pointerInfo.pickInfo.pickedMesh;
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
          merge();
        }
        pState = "idle";
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
        button === "remove" &&
        pointerInfo.pickInfo.pickedMesh
      ) {
        const mesh = pointerInfo.pickInfo.pickedMesh;
        [xy, zy].forEach((plane) => {
          if (mesh.name in segs[plane.name]) {
            delete segs[plane.name][mesh.name];
            mesh.dispose();
            merge();
          }
        });
      }
    });

    const ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI();
    const panel = new GUI.StackPanel();
    panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    ui.addControl(panel);
    const makeButton = (text, cb) => {
      const b = GUI.Button.CreateSimpleButton(uuid(), text);
      b.width = "100px";
      b.height = "20px";
      b.color = "white";
      b.onPointerUpObservable.add(cb);
      panel.addControl(b);
    };
    makeButton("sequence", () => {
      button = "sequence";
    });
    makeButton("remove", () => {
      button = "remove";
    });
    makeButton("cancel", () => {
      pState = "idle";
      pTarget = null;
      pFrom = null;
      pTo = null;
      button = null;
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
