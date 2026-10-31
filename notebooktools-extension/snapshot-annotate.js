const NotebookToolsSnapshotAnnotate = {
  ROOT_ID: "notebooktools-snapshot-annotate",
  STROKE_COLOR: "#ef4444",
  LINE_WIDTH: 3,
  HANDLE_SIZE: 8,

  open(dataUrl) {
    return new Promise((resolve, reject) => {
      if (document.getElementById(this.ROOT_ID)) {
        reject(new Error("Annotation editor is already open."));
        return;
      }

      const state = {
        tool: "select",
        shapes: [],
        drawing: false,
        startX: 0,
        startY: 0,
        currentPath: null,
        preview: null,
        busy: false,
        selectedIndex: -1,
        dragMode: null,
        resizeHandle: null,
        dragOrigin: null,
        shapeSnapshot: null
      };

      const root = document.createElement("div");
      root.id = this.ROOT_ID;
      root.dataset.tool = state.tool;
      root.innerHTML = `
        <div class="nt-annotate-toolbar">
          <span>Select · Draw · Undo · Save</span>
          <div class="nt-annotate-tools">
            <button type="button" data-tool="select" title="Select / move / resize (V)">Select</button>
            <button type="button" data-tool="pencil" title="Pencil (P)">Pencil</button>
            <button type="button" data-tool="rect" title="Rectangle (R)">Rect</button>
            <button type="button" data-tool="circle" title="Circle (C)">Circle</button>
            <button type="button" data-tool="arrow" title="Arrow (A)">Arrow</button>
          </div>
          <span class="nt-annotate-sep"></span>
          <button type="button" data-action="undo" title="Undo (Ctrl+Z)">Undo</button>
          <span class="nt-annotate-sep"></span>
          <button type="button" class="primary" data-action="save" title="Save (Enter)">Save</button>
          <button type="button" data-action="cancel" title="Cancel (Esc)">Cancel</button>
        </div>
        <div class="nt-annotate-stage">
          <canvas></canvas>
        </div>
      `;

      const canvas = root.querySelector("canvas");
      const context = canvas.getContext("2d");
      const image = new Image();
      let imageWidth = 0;
      let imageHeight = 0;

      const setBusy = (nextBusy) => {
        state.busy = nextBusy;
        root.classList.toggle("is-busy", nextBusy);
      };

      const setTool = (tool) => {
        state.tool = tool;
        root.dataset.tool = tool;
        root.querySelectorAll("[data-tool]").forEach((button) => {
          button.classList.toggle("is-active", button.dataset.tool === tool);
        });

        if (tool !== "select") {
          state.selectedIndex = -1;
          redraw();
        }

        canvas.style.cursor =
          tool === "select" ? "default" : tool === "pencil" ? "crosshair" : "crosshair";
      };

      const canvasPoint = (event) => {
        const bounds = canvas.getBoundingClientRect();
        const x = (event.clientX - bounds.left) * (canvas.width / bounds.width);
        const y = (event.clientY - bounds.top) * (canvas.height / bounds.height);

        return { x, y };
      };

      const drawArrow = (ctx, x1, y1, x2, y2, color, lineWidth) => {
        const headLength = Math.max(28, lineWidth * 11);
        const headAngle = Math.PI / 4.5;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const shorten = Math.min(headLength * 0.75, Math.hypot(x2 - x1, y2 - y1) * 0.35);
        const lineEndX = x2 - shorten * Math.cos(angle);
        const lineEndY = y2 - shorten * Math.sin(angle);

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(lineEndX, lineEndY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLength * Math.cos(angle - headAngle), y2 - headLength * Math.sin(angle - headAngle));
        ctx.lineTo(x2 - headLength * Math.cos(angle + headAngle), y2 - headLength * Math.sin(angle + headAngle));
        ctx.closePath();
        ctx.fill();
      };

      const getShapeBounds = (shape) => {
        if (!shape) {
          return null;
        }

        if (shape.type === "rect" || shape.type === "circle") {
          return {
            x: shape.x,
            y: shape.y,
            w: shape.w,
            h: shape.h
          };
        }

        if (shape.type === "arrow") {
          return {
            x: Math.min(shape.x1, shape.x2),
            y: Math.min(shape.y1, shape.y2),
            w: Math.abs(shape.x2 - shape.x1),
            h: Math.abs(shape.y2 - shape.y1)
          };
        }

        if (shape.type === "path" && shape.points?.length) {
          const xs = shape.points.map((point) => point[0]);
          const ys = shape.points.map((point) => point[1]);

          return {
            x: Math.min(...xs),
            y: Math.min(...ys),
            w: Math.max(...xs) - Math.min(...xs),
            h: Math.max(...ys) - Math.min(...ys)
          };
        }

        return null;
      };

      const pointInBounds = (point, bounds, padding = 6) => {
        if (!bounds) {
          return false;
        }

        return (
          point.x >= bounds.x - padding &&
          point.x <= bounds.x + bounds.w + padding &&
          point.y >= bounds.y - padding &&
          point.y <= bounds.y + bounds.h + padding
        );
      };

      const distanceToSegment = (px, py, x1, y1, x2, y2) => {
        const dx = x2 - x1;
        const dy = y2 - y1;

        if (!dx && !dy) {
          return Math.hypot(px - x1, py - y1);
        }

        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;

        return Math.hypot(px - projX, py - projY);
      };

      const hitTestShape = (point, shape) => {
        if (!shape) {
          return false;
        }

        if (shape.type === "rect" || shape.type === "circle") {
          return pointInBounds(point, getShapeBounds(shape), 8);
        }

        if (shape.type === "arrow") {
          return (
            distanceToSegment(point.x, point.y, shape.x1, shape.y1, shape.x2, shape.y2) <= 10 ||
            Math.hypot(point.x - shape.x1, point.y - shape.y1) <= 10 ||
            Math.hypot(point.x - shape.x2, point.y - shape.y2) <= 12
          );
        }

        if (shape.type === "path") {
          return pointInBounds(point, getShapeBounds(shape), 10);
        }

        return false;
      };

      const findShapeAt = (point) => {
        for (let index = state.shapes.length - 1; index >= 0; index -= 1) {
          if (hitTestShape(point, state.shapes[index])) {
            return index;
          }
        }

        return -1;
      };

      const getHandles = (shape) => {
        if (!shape) {
          return [];
        }

        if (shape.type === "arrow") {
          return [
            { id: "start", x: shape.x1, y: shape.y1 },
            { id: "end", x: shape.x2, y: shape.y2 }
          ];
        }

        const bounds = getShapeBounds(shape);

        if (!bounds) {
          return [];
        }

        const { x, y, w, h } = bounds;
        const cx = x + w / 2;
        const cy = y + h / 2;

        return [
          { id: "nw", x, y },
          { id: "n", x: cx, y },
          { id: "ne", x: x + w, y },
          { id: "e", x: x + w, y: cy },
          { id: "se", x: x + w, y: y + h },
          { id: "s", x: cx, y: y + h },
          { id: "sw", x, y: y + h },
          { id: "w", x, y: cy }
        ];
      };

      const hitTestHandle = (point, shape) => {
        const handles = getHandles(shape);
        const radius = this.HANDLE_SIZE + 4;

        for (const handle of handles) {
          if (Math.hypot(point.x - handle.x, point.y - handle.y) <= radius) {
            return handle.id;
          }
        }

        return null;
      };

      const cloneShape = (shape) => JSON.parse(JSON.stringify(shape));

      const moveShape = (shape, dx, dy) => {
        if (shape.type === "rect" || shape.type === "circle") {
          shape.x += dx;
          shape.y += dy;
          return;
        }

        if (shape.type === "arrow") {
          shape.x1 += dx;
          shape.y1 += dy;
          shape.x2 += dx;
          shape.y2 += dy;
          return;
        }

        if (shape.type === "path" && shape.points?.length) {
          shape.points = shape.points.map(([x, y]) => [x + dx, y + dy]);
        }
      };

      const resizeShape = (shape, handle, point, origin) => {
        if (shape.type === "arrow") {
          if (handle === "start") {
            shape.x1 = point.x;
            shape.y1 = point.y;
          } else if (handle === "end") {
            shape.x2 = point.x;
            shape.y2 = point.y;
          }

          return;
        }

        const start = origin || getShapeBounds(shape);
        let { x, y, w, h } = start;
        const right = x + w;
        const bottom = y + h;

        if (handle.includes("n")) {
          y = point.y;
        }

        if (handle.includes("s")) {
          h = point.y - y;
        }

        if (handle.includes("w")) {
          x = point.x;
        }

        if (handle.includes("e")) {
          w = point.x - x;
        }

        if (handle === "n") {
          h = bottom - point.y;
        }

        if (handle === "s") {
          h = point.y - y;
        }

        if (handle === "w") {
          w = right - point.x;
        }

        if (handle === "e") {
          w = point.x - x;
        }

        if (w < 0) {
          x += w;
          w = Math.abs(w);
        }

        if (h < 0) {
          y += h;
          h = Math.abs(h);
        }

        shape.x = x;
        shape.y = y;
        shape.w = w;
        shape.h = h;
      };

      const drawShape = (ctx, shape) => {
        if (!shape) {
          return;
        }

        const color = shape.color || this.STROKE_COLOR;
        const lineWidth = shape.lineWidth || this.LINE_WIDTH;

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (shape.type === "rect") {
          ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
          return;
        }

        if (shape.type === "circle") {
          ctx.beginPath();
          ctx.ellipse(
            shape.x + shape.w / 2,
            shape.y + shape.h / 2,
            Math.abs(shape.w) / 2,
            Math.abs(shape.h) / 2,
            0,
            0,
            Math.PI * 2
          );
          ctx.stroke();
          return;
        }

        if (shape.type === "arrow") {
          drawArrow(ctx, shape.x1, shape.y1, shape.x2, shape.y2, color, lineWidth);
          return;
        }

        if (shape.type === "path" && shape.points?.length) {
          ctx.beginPath();
          ctx.moveTo(shape.points[0][0], shape.points[0][1]);

          for (let index = 1; index < shape.points.length; index += 1) {
            ctx.lineTo(shape.points[index][0], shape.points[index][1]);
          }

          ctx.stroke();
        }
      };

      const drawSelection = (ctx, shape) => {
        const bounds = getShapeBounds(shape);

        if (!bounds) {
          return;
        }

        ctx.save();
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8);
        ctx.setLineDash([]);

        getHandles(shape).forEach((handle) => {
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "#2563eb";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.rect(
            handle.x - this.HANDLE_SIZE / 2,
            handle.y - this.HANDLE_SIZE / 2,
            this.HANDLE_SIZE,
            this.HANDLE_SIZE
          );
          ctx.fill();
          ctx.stroke();
        });

        ctx.restore();
      };

      const redraw = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, imageWidth, imageHeight);

        state.shapes.forEach((shape) => drawShape(context, shape));

        if (state.preview) {
          drawShape(context, state.preview);
        }

        if (state.selectedIndex >= 0 && state.shapes[state.selectedIndex]) {
          drawSelection(context, state.shapes[state.selectedIndex]);
        }
      };

      const normalizeBox = (x1, y1, x2, y2) => ({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        w: Math.abs(x2 - x1),
        h: Math.abs(y2 - y1)
      });

      const cleanup = () => {
        window.removeEventListener("keydown", onKeyDown, true);
        root.remove();
      };

      const finish = (result) => {
        cleanup();

        if (result) {
          resolve(result);
        } else {
          reject(new Error("Annotation cancelled."));
        }
      };

      const onKeyDown = (event) => {
        if (state.busy) {
          return;
        }

        const key = String(event.key || "").toLowerCase();

        if (event.key === "Escape") {
          event.preventDefault();

          if (state.selectedIndex >= 0) {
            state.selectedIndex = -1;
            redraw();
            return;
          }

          finish(null);
          return;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          void saveAnnotated();
          return;
        }

        if ((event.ctrlKey || event.metaKey) && key === "z") {
          event.preventDefault();
          state.shapes.pop();
          state.selectedIndex = -1;
          state.preview = null;
          redraw();
          return;
        }

        if (key === "v") {
          setTool("select");
        } else if (key === "p") {
          setTool("pencil");
        } else if (key === "r") {
          setTool("rect");
        } else if (key === "c") {
          setTool("circle");
        } else if (key === "a") {
          setTool("arrow");
        } else if ((event.key === "Delete" || event.key === "Backspace") && state.selectedIndex >= 0) {
          event.preventDefault();
          state.shapes.splice(state.selectedIndex, 1);
          state.selectedIndex = -1;
          redraw();
        }
      };

      const saveAnnotated = async () => {
        setBusy(true);
        state.preview = null;
        state.selectedIndex = -1;
        redraw();

        try {
          const output = canvas.toDataURL("image/png");
          finish(output);
        } catch (error) {
          setBusy(false);
          window.alert(error.message || "Could not save annotated image.");
        }
      };

      image.onload = () => {
        imageWidth = image.naturalWidth || image.width;
        imageHeight = image.naturalHeight || image.height;

        const maxWidth = Math.max(320, window.innerWidth - 48);
        const maxHeight = Math.max(240, window.innerHeight - 120);
        const scale = Math.min(1, maxWidth / imageWidth, maxHeight / imageHeight);

        canvas.width = Math.round(imageWidth * scale);
        canvas.height = Math.round(imageHeight * scale);
        redraw();
      };

      image.onerror = () => {
        cleanup();
        reject(new Error("Could not load captured image for annotation."));
      };

      image.src = dataUrl;

      root.querySelectorAll("[data-tool]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          setTool(button.dataset.tool);
        });
      });

      root.querySelector('[data-action="undo"]')?.addEventListener("click", (event) => {
        event.preventDefault();
        state.shapes.pop();
        state.selectedIndex = -1;
        state.preview = null;
        redraw();
      });

      root.querySelector('[data-action="save"]')?.addEventListener("click", (event) => {
        event.preventDefault();
        void saveAnnotated();
      });

      root.querySelector('[data-action="cancel"]')?.addEventListener("click", (event) => {
        event.preventDefault();
        finish(null);
      });

      canvas.addEventListener("mousedown", (event) => {
        if (state.busy) {
          return;
        }

        const point = canvasPoint(event);

        if (state.tool === "select") {
          const selected = state.selectedIndex >= 0 ? state.shapes[state.selectedIndex] : null;
          const handle = selected ? hitTestHandle(point, selected) : null;

          if (handle && selected) {
            state.dragMode = "resize";
            state.resizeHandle = handle;
            state.dragOrigin = getShapeBounds(cloneShape(selected));
            state.shapeSnapshot = cloneShape(selected);
            state.startX = point.x;
            state.startY = point.y;
            event.preventDefault();
            return;
          }

          const hitIndex = findShapeAt(point);

          if (hitIndex >= 0) {
            state.selectedIndex = hitIndex;
            state.dragMode = "move";
            state.startX = point.x;
            state.startY = point.y;
            state.shapeSnapshot = cloneShape(state.shapes[hitIndex]);
            redraw();
            event.preventDefault();
            return;
          }

          state.selectedIndex = -1;
          redraw();
          return;
        }

        state.drawing = true;
        state.startX = point.x;
        state.startY = point.y;
        state.selectedIndex = -1;

        if (state.tool === "pencil") {
          state.currentPath = {
            type: "path",
            points: [[point.x, point.y]],
            color: this.STROKE_COLOR,
            lineWidth: this.LINE_WIDTH
          };
        }

        event.preventDefault();
      });

      canvas.addEventListener("mousemove", (event) => {
        const point = canvasPoint(event);

        if (state.dragMode === "move" && state.shapeSnapshot && state.selectedIndex >= 0) {
          const dx = point.x - state.startX;
          const dy = point.y - state.startY;
          const next = cloneShape(state.shapeSnapshot);
          moveShape(next, dx, dy);
          state.shapes[state.selectedIndex] = next;
          redraw();
          event.preventDefault();
          return;
        }

        if (
          state.dragMode === "resize" &&
          state.shapeSnapshot &&
          state.selectedIndex >= 0 &&
          state.resizeHandle
        ) {
          const next = cloneShape(state.shapeSnapshot);
          resizeShape(next, state.resizeHandle, point, state.dragOrigin);
          state.shapes[state.selectedIndex] = next;
          redraw();
          event.preventDefault();
          return;
        }

        if (!state.drawing || state.busy) {
          return;
        }

        if (state.tool === "pencil" && state.currentPath) {
          state.currentPath.points.push([point.x, point.y]);
          state.preview = state.currentPath;
          redraw();
          return;
        }

        if (state.tool === "rect") {
          state.preview = {
            type: "rect",
            ...normalizeBox(state.startX, state.startY, point.x, point.y),
            color: this.STROKE_COLOR,
            lineWidth: this.LINE_WIDTH
          };
        } else if (state.tool === "circle") {
          state.preview = {
            type: "circle",
            ...normalizeBox(state.startX, state.startY, point.x, point.y),
            color: this.STROKE_COLOR,
            lineWidth: this.LINE_WIDTH
          };
        } else if (state.tool === "arrow") {
          state.preview = {
            type: "arrow",
            x1: state.startX,
            y1: state.startY,
            x2: point.x,
            y2: point.y,
            color: this.STROKE_COLOR,
            lineWidth: this.LINE_WIDTH
          };
        }

        redraw();
        event.preventDefault();
      });

      const endDraw = (event) => {
        if (state.dragMode) {
          state.dragMode = null;
          state.resizeHandle = null;
          state.dragOrigin = null;
          state.shapeSnapshot = null;
          event.preventDefault();
          return;
        }

        if (!state.drawing || state.busy) {
          return;
        }

        state.drawing = false;
        const point = canvasPoint(event);

        if (state.tool === "pencil" && state.currentPath?.points?.length > 1) {
          state.shapes.push(state.currentPath);
        } else if (state.tool === "rect") {
          const box = normalizeBox(state.startX, state.startY, point.x, point.y);

          if (box.w >= 2 && box.h >= 2) {
            state.shapes.push({ type: "rect", ...box, color: this.STROKE_COLOR, lineWidth: this.LINE_WIDTH });
          }
        } else if (state.tool === "circle") {
          const box = normalizeBox(state.startX, state.startY, point.x, point.y);

          if (box.w >= 2 && box.h >= 2) {
            state.shapes.push({ type: "circle", ...box, color: this.STROKE_COLOR, lineWidth: this.LINE_WIDTH });
          }
        } else if (state.tool === "arrow") {
          const distance = Math.hypot(point.x - state.startX, point.y - state.startY);

          if (distance >= 6) {
            state.shapes.push({
              type: "arrow",
              x1: state.startX,
              y1: state.startY,
              x2: point.x,
              y2: point.y,
              color: this.STROKE_COLOR,
              lineWidth: this.LINE_WIDTH
            });
          }
        }

        state.currentPath = null;
        state.preview = null;
        redraw();
        event.preventDefault();
      };

      canvas.addEventListener("mouseup", endDraw);
      canvas.addEventListener("mouseleave", endDraw);

      setTool("select");
      document.documentElement.append(root);
      window.addEventListener("keydown", onKeyDown, true);
    });
  }
};

if (typeof window !== "undefined") {
  window.NotebookToolsSnapshotAnnotate = NotebookToolsSnapshotAnnotate;
}
