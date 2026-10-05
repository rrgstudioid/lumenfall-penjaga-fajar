import * as T from 'three';
import { IRONVEIL_ASSETS } from './ironveil-mines-materials';
export const MINE_TEXTURES = IRONVEIL_ASSETS;
/** Static shell uses the occlusion-aware offline bake, actors use the light pool. */
export function createMineMaterials(
  textures: Record<keyof typeof MINE_TEXTURES, T.Texture>,
) {
  const floor = new T.MeshBasicMaterial({
    map: textures.dirt,
    color: '#bda78b',
    vertexColors: true,
    side: T.DoubleSide,
  });
  const rock = new T.MeshBasicMaterial({
    map: textures.rock,
    color: '#92979c',
    vertexColors: true,
    side: T.DoubleSide,
  });
  rock.onBeforeCompile = (s) => {
    s.vertexShader = 'varying vec3 mineP,mineN;\n' + s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nmineP=position;mineN=normal;',
    );
    s.fragmentShader = 'varying vec3 mineP,mineN;\n' + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      '#include <map_fragment>',
      `vec3 weights=pow(abs(normalize(mineN)),vec3(4.));weights/=max(.001,weights.x+weights.y+weights.z);
      vec4 stone=texture2D(map,mineP.zy*.10)*weights.x+texture2D(map,mineP.xz*.10)*weights.y+texture2D(map,mineP.xy*.10)*weights.z;
      float luminance=dot(stone.rgb,vec3(.299,.587,.114));
      diffuseColor*=vec4(vec3(luminance)*vec3(.91,.94,1.),stone.a);`,
    );
  };
  rock.customProgramCacheKey = () => 'ironveil-interior-triplanar-baked-v1';
  const bridge = new T.MeshBasicMaterial({
    map: textures.wood,
    color: '#907250',
    vertexColors: true,
    side: T.DoubleSide,
  });
  const wood = new T.MeshBasicMaterial({
    map: textures.wood,
    color: '#aa8657',
  });
  const metal = new T.MeshBasicMaterial({ color: '#4e5150' });
  const flame = new T.MeshBasicMaterial({
    color: '#ffad32',
    toneMapped: false,
  });
  const mineral = new T.MeshBasicMaterial({ color: '#327e9a' });
  return { floor, rock, bridge, wood, metal, flame, mineral };
}
