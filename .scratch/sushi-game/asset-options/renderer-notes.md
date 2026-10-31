# Sushi game: renderer recommendation

Research date: 2026-10-25. This is a proposal, not an engine migration or a change to the agreed gameplay scope.

## Recommendation

**Choose the art direction first. For the current idle restaurant, keep TypeScript, lit-html and the existing state/service layer; use coordinated image layers or pre-rendered 3D sprites for the first art upgrade.** A new renderer can enable richer motion or camera control, but it does not by itself improve composition, asset consistency, lighting or the player loop.

If the preferred look is a small living 3D diorama, make one isolated Three.js proof before committing: one room, a fixed orthographic camera, a few furniture models, a chef animation, and the existing upgrade states. Retain the current DOM controls. If real-time cooking or extensive 2D placement becomes the product goal, Phaser becomes the stronger default.

These are project-specific judgments based on the code and the documented capabilities below, not measured performance claims.

## What is already in place

- The game is loaded through a dynamic import in [course-view.ts](../../../src/course/course-view.ts). The study app should continue to avoid loading game art and rendering libraries until the restaurant opens.
- [restaurant-scene.ts](../../../src/course/sushi-game/restaurant-scene.ts) uses a shared 30-degree SVG projection. It reads inventory and equipped fixed slots, so the artwork is already separated from economic rules.
- [sushi-view.ts](../../../src/course/sushi-game/sushi-view.ts) owns the DOM interface and client controller. It refreshes visible UI once per second and pauses background refreshes. A canvas renderer must survive those refreshes rather than being recreated every second.
- [service.ts](../../../src/course/sushi-game/service.ts) calls authenticated server operations. [functions/src/index.ts](../../../functions/src/index.ts) validates the operation and uses the domain service. Client animations must never become the authority for money, purchases or unlocks.
- The [game brief](../../../sushigame.md) specifies idle earnings, fixed equipment locations, fixed decoration slots and a predefined conveyor installation. Free placement, pathfinding and a belt editor are outside the present scope. Some early “backend gap” wording in that brief predates the current implementation; the current source is the evidence for the existing backend.

## Rendering choices

| Approach | Best reason to choose it | Tradeoff for this game |
| --- | --- | --- |
| **Existing SVG / DOM image layers** | Fixed camera, a small room, a handful of upgrades and simple ambient animations | Lowest integration effort. More complex moving crowds and occlusion become manual work. Raster assets must be authored at an appropriate resolution. |
| **Pre-rendered 3D into 2D layers** | The polished lighting and consistent perspective of a 3D kit, without rendering the models on the phone | A production workflow, not another browser engine. Furniture, characters and shadows need consistent cameras, scale, pivots and export settings. Rotation requires more views. |
| **PixiJS** | Many animated 2D sprites, sortable layers, zoom and pointer interaction, while retaining custom app logic | Adds a rendering system and lifecycle work; does not eliminate the need to design gameplay. A sensible middle ground if the game stays an idle scene but becomes much more animated. |
| **Phaser** | An active 2D game: cooking actions, timers, customer orders, collisions or many interactive placements | Comes with scene lifecycle, input, animation, loading and other game systems. Those are useful for new play, but mostly extra machinery for today's fixed-slot idle view. |
| **Three.js** | Real 3D models, changing viewpoint, depth-correct animation and adjustable lighting | Strong match for a 3D diorama. Requires model preparation, lighting, mobile GPU testing, loading/error states and explicit resource cleanup. It is a rendering library, so game rules remain ours. |

SVG can contain raster images directly, which means the current scene can use actual public artwork without drawing every object in TypeScript. [MDN: SVG image](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/image)

PixiJS has a hierarchical scene graph and GPU-backed renderers. Its current v8 documentation recommends WebGL for production; WebGPU is described as experimental and the Canvas renderer as forthcoming. Do not assume automatic Canvas fallback. Sprite sheets and careful texture use are documented performance techniques. [Scene graph](https://pixijs.com/8.x/guides/concepts/scene-graph), [renderers](https://pixijs.com/8.x/guides/components/renderers), [performance tips](https://pixijs.com/8.x/guides/concepts/performance-tips)

Phaser scenes own input, tweens, game objects, cameras and other systems, with pause, sleep and shutdown lifecycles. These are the concrete reasons to select it when gameplay expands. Physics is optional; it need not be enabled for an idle scene. [Phaser scenes](https://docs.phaser.io/phaser/concepts/scenes)

Three.js orthographic cameras preserve an object's apparent size regardless of distance, making them suitable for the requested isometric presentation. Its model-loading guidance recommends glTF/GLB for runtime delivery. Keep the camera fixed initially; rotation is a separate product choice. [OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html), [loading models](https://threejs.org/manual/pages/loading-3d-models.html)

## A small boundary that keeps every option open

Keep authoritative state, purchase commands and the renderer separate:

```text
Firebase callable operations -> confirmed restaurant state
                                      |
                         scene model / asset manifest
                         /                         \
               restaurant renderer          lit-html controls
               visuals and animation        money, shop, slots
```

The scene model only needs owned equipment, recipe/decor IDs and visual anchors. Use stable keys such as `prep_counter` and `paper_lantern`; map those to files in an asset manifest instead of making filenames part of saved state. For each imported asset record source URL, creator, license, native size or units, anchor/pivot and intended orientation.

If a canvas renderer is chosen, give it a small `mount / update / resize / setPaused / dispose` interface. Update visibility or swap models on confirmed state changes. Keep a separate animation clock for decorative chef movements, customers and belt plates. Preserve reduced-motion behavior, pause while hidden, and dispose on leaving the sushi route or signing out. Three.js explicitly requires disposal of textures, geometries and materials; removing a canvas alone is not sufficient. [Three.js cleanup](https://threejs.org/manual/pages/cleanup.html)

Do not move shop text, forms, status messages or keyboard controls into the canvas. They can remain ordinary HTML with the current semantics. A scene-click shortcut may open an existing decoration panel rather than creating a second purchase flow. No React conversion is needed.

## Suggested next slice

1. Choose one coherent asset family and verify the exact downloaded license. Avoid combining mismatched perspective, pixel density and lighting just because packs are free.
2. Assemble one complete room at the intended phone size. Show both starter and upgraded states before investing in new gameplay.
3. Add one visual event: purchase makes the corresponding object appear with a short transition. Add a small chef idle loop and moving belt plates if the selected assets support them. Those animations illustrate production; they do not generate income.
4. Compare a layered 2D version with a fixed-camera 3D proof only if the preferred assets and desired motion make the comparison worthwhile.
5. Integrate the chosen renderer behind the existing scene boundary. Preserve collection, purchase, slot-selection, reload, account-change and route-exit tests.

The product improvement I would prioritize alongside art is a larger restaurant area with the cash balance and one next-upgrade goal nearby; keep the longer catalog available below or in a drawer. This is a design proposal, not a change made by this research.

## Proposed mobile acceptance budgets

These are initial engineering targets to test on an agreed mid-range phone, **not measurements of any of the candidate packs**:

| Measure | Proposed first target |
| --- | --- |
| Extra game assets requested on study routes | Zero |
| Initial restaurant art transfer | At most 2 MB compressed for layered 2D; at most 5 MB for a 3D proof |
| Visible ambient animation | Aim for 60 fps; maintain 30 fps on the target phone without long stalls |
| Cold scene presentation | Useful loading or fallback state immediately; complete room within 3 seconds under a documented network profile |
| Hidden game / reduced motion | Stop ambient animation; use event-driven rendering where the scene is static |
| Repeated enter/leave | No sustained growth in active loops, listeners or GPU resources after 10 cycles |
| Usability | No horizontal overflow at 390 px; controls remain readable, keyboard accessible and usable by touch |

For a mostly static Three.js scene, render on changes rather than continuously. When animated characters are present, run the loop only while that animation is visible and enabled. This trades battery use against motion deliberately. [Three.js rendering on demand](https://threejs.org/manual/pages/rendering-on-demand.html)

No renderer, pack download size, frame rate, GPU memory use or device compatibility was benchmarked in this research pass. Validate those after assembling the chosen scene.
