#!/usr/bin/env python3
"""
BuyrFindr photo patch #3  (run from ~/Buyer-Finder, on the branch that already has patch #1/#2)

Replaces the big "Add your own photo" button with ONE photo row under the title:

    [ 📷 Add photo ]  [your photos, with an x]  [stock photos ... swipe ->]

and hides the old "Images / Choose Files" row at the bottom of the form.
Safe: backs up posts.js first, and aborts without changing anything if the
previous patch isn't found.
"""
import shutil
import subprocess
import sys
from pathlib import Path

START = '/* bf-photo-patch: big "add your own photo" button'
V3 = "bf-photo-patch: photo row v3"

posts = Path("posts.js")
if not posts.exists():
    sys.exit("Run this inside ~/Buyer-Finder (posts.js not found here).")
js = posts.read_text(encoding="utf-8")

if V3 in js:
    sys.exit("Patch #3 is already applied. Nothing to do.")

a = js.find(START)
if a < 0:
    sys.exit("ABORT (nothing changed): the earlier photo patch isn't in this posts.js. Are you on the BF22 branch?")
b = js.find("\n  })();", a)
if b < 0:
    sys.exit("ABORT (nothing changed): couldn't find the end of the old button block. Paste me that area of posts.js.")
b += len("\n  })();")

NEW = r"""/* bf-photo-patch: photo row v3 - one row: add tile + your photos + stock photos */
  (function bfWirePhotoRow() {
    function fileInput() {
      return (typeof postImage !== "undefined" && postImage) ||
        document.querySelector("#modal-backdrop input[type=file]:not(#bf-photo-input)");
    }
    function tryWire() {
      const wrap = document.getElementById("suggested-images-wrap");
      const grid = document.getElementById("suggested-images-grid");
      if (!wrap || !grid || document.getElementById("bf-photo-row")) return;

      if (!document.getElementById("bf-photo-css")) {
        const st = document.createElement("style");
        st.id = "bf-photo-css";
        st.textContent =
          "#suggested-images-wrap{display:none!important;margin:0!important}" +
          "#bf-photo-row{display:flex;gap:8px;align-items:stretch;margin-top:12px}" +
          "#bf-photo-row #suggested-images-grid{flex:1 1 auto;min-width:0;padding-bottom:0!important}";
        document.head.appendChild(st);
      }

      const row = document.createElement("div");
      row.id = "bf-photo-row";

      const tile = document.createElement("button");
      tile.type = "button";
      tile.id = "bf-photo-btn";
      tile.style.cssText = "flex:0 0 auto;width:72px;min-height:72px;border:2px dashed #26d07c;border-radius:12px;background:rgba(38,208,124,.08);color:#26d07c;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-weight:700;font-size:12px;cursor:pointer;padding:0;";
      tile.innerHTML = '<span style="font-size:26px;line-height:1">📷</span><span>Add photo</span>';

      const own = document.createElement("div");
      own.id = "bf-own-thumbs";
      own.style.cssText = "display:flex;gap:8px;flex:0 0 auto;";

      const inp = document.createElement("input");
      inp.type = "file";
      inp.id = "bf-photo-input";
      inp.accept = "image/*";
      inp.multiple = true;
      inp.style.display = "none";

      const cap = document.createElement("div");
      cap.id = "bf-photo-cap";
      cap.style.cssText = "font-size:12px;opacity:.7;margin-top:6px;";

      wrap.parentNode.insertBefore(row, wrap);
      row.appendChild(tile);
      row.appendChild(own);
      row.appendChild(grid);
      row.appendChild(inp);
      row.parentNode.insertBefore(cap, row.nextSibling);

      // hide the old "Images / Choose Files" row (the input itself stays, the save code still reads it)
      const real = fileInput();
      if (real) {
        const fr = (real.closest && real.closest(".field-row")) || real;
        fr.style.display = "none";
      }

      function updateCap() {
        const r = fileInput();
        const n = r && r.files ? r.files.length : 0;
        const hasStock = grid.querySelector(".suggested-img-thumb");
        cap.textContent = n
          ? "Your photo will be used."
          : hasStock
            ? "Stock photo auto-picked. Tap another to swap, or add your own."
            : "Add a photo so people can see what you mean.";
      }

      function renderOwn() {
        const r = fileInput();
        own.innerHTML = "";
        const files = r ? Array.from(r.files || []) : [];
        files.forEach((f, i) => {
          const box = document.createElement("div");
          box.style.cssText = "position:relative;flex:0 0 auto;width:72px;min-height:72px;border-radius:12px;overflow:hidden;border:2px solid #26d07c;";
          const im = document.createElement("img");
          im.src = URL.createObjectURL(f);
          im.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
          const x = document.createElement("button");
          x.type = "button";
          x.textContent = "✕";
          x.style.cssText = "position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;border:0;background:rgba(0,0,0,.65);color:#fff;font-size:12px;line-height:22px;padding:0;cursor:pointer;";
          x.addEventListener("click", () => {
            const dt = new DataTransfer();
            files.forEach((g, j) => { if (j !== i) dt.items.add(g); });
            r.files = dt.files;
            renderOwn();
          });
          box.appendChild(im);
          box.appendChild(x);
          own.appendChild(box);
        });
        updateCap();
      }

      tile.addEventListener("click", () => inp.click());
      inp.addEventListener("change", () => {
        try {
          const r = fileInput();
          if (!r) return;
          const dt = new DataTransfer();
          Array.from(r.files || []).forEach(f => dt.items.add(f));
          Array.from(inp.files || []).forEach(f => dt.items.add(f));
          r.files = dt.files;
          inp.value = "";
          renderOwn();
        } catch (e) {
          console.warn("Add-photo failed:", e);
        }
      });
      new MutationObserver(updateCap).observe(grid, { childList: true });
      row.__bfRender = renderOwn;
      renderOwn();
    }

    tryWire();
    document.addEventListener("DOMContentLoaded", tryWire);
    document.addEventListener("click", e => {
      if (e.target && e.target.closest && e.target.closest("#fab-add, .edit-btn")) {
        setTimeout(() => {
          tryWire();
          const row = document.getElementById("bf-photo-row");
          if (row && row.__bfRender) row.__bfRender();
        }, 0);
      }
    });
  })();"""

js = js[:a] + NEW + js[b:]

bak = Path("posts.js.bak-photos3")
if not bak.exists():
    shutil.copy(posts, bak)
posts.write_text(js, encoding="utf-8")
print("Patched posts.js (photo row v3). Backup: posts.js.bak-photos3")

if shutil.which("node"):
    tmp = Path("posts_check.mjs")
    try:
        tmp.write_text(js, encoding="utf-8")
        r = subprocess.run(["node", "--check", str(tmp)], capture_output=True, text=True)
        if r.returncode == 0:
            print("node syntax check: OK")
        else:
            print("node syntax check: FAILED (can be a false alarm from module-mode). Details:")
            print(r.stderr[:600])
            print("To undo: cp posts.js.bak-photos3 posts.js")
    except Exception as e:
        print("(syntax check skipped:", e, ")")
    finally:
        try:
            tmp.unlink()
        except Exception:
            pass
else:
    print("(node not installed, skipped syntax check)")
