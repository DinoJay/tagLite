import * as d3 from "d3";
// import _ from "lodash";
import offsetInterpolate from "./polyOffset.js";

function rectCollide(nodes, strength) {
  return function(alpha) {
    var quadtree = d3.quadtree()
      .x(d => d.x)
      .y(d => d.y)
      .addAll(nodes);
    var padding = 6;

    for (var i = 0, n = nodes.length; i < n; ++i) {
      var node = nodes[i];
      quadtree.visit(function(quad, x1, y1, x2, y2) {

        if (quad.data && (quad.data !== node)) {
          var x = node.x - quad.data.x,
            y = node.y - quad.data.y,
            xSpacing = (quad.data.width + node.width) / 2,
            ySpacing = (quad.data.height + node.height + padding) / 2,
            absX = Math.abs(x),
            absY = Math.abs(y),
            l,
            lx,
            ly;

          // console.log("Node quad", node.width, node.height);

          if (absX < xSpacing && absY < ySpacing) {
            l = Math.sqrt(x * x + y * y);

            lx = (absX - xSpacing) / l;
            ly = (absY - ySpacing) / l;

            // the one that"s barely within the bounds probably triggered the collision
            if (Math.abs(lx) > Math.abs(ly)) {
              lx = 0;
            } else {
              ly = 0;
            }

            x *= lx * alpha * strength;
            y *= ly * alpha * strength;

            node.vx -= x;
            node.vy -= y;
            quad.data.vx += x;
            quad.data.vy += y;

            // updated = true;
          }
        }
      });
    }
  };
}

function pythag(r, b, coord, radius, w) {
  var hyp2 = Math.pow(radius, 2),
    strokeWidth = 2;
  // r += 1;

  // force use of b coord that exists in circle to avoid sqrt(x<0)
  b = Math.min(w - r - strokeWidth, Math.max(r + strokeWidth, b));

  var b2 = Math.pow((b - radius), 2),
    a = Math.sqrt(hyp2 - b2);

  // radius - sqrt(hyp^2 - b^2) < coord < sqrt(hyp^2 - b^2) + radius
  coord = Math.max(radius - a + r + strokeWidth,
    Math.min(a + radius - r - strokeWidth, coord));

  return coord;
}

function innerCircleCollide(nodes, r) {
  return function() {
    for (var i = 0, n = nodes.length; i < n; ++i) {
      var d = nodes[i];
      // d.vx = pythag(d.width / 2, d.y, d.x, r, r * 2);
      // d.vy = pythag(d.height / 2, d.x, d.y, r, r * 2);
      d.x = pythag(d.width / 2, d.y, d.x, r, r * 2);
      d.y = pythag(d.height / 2, d.x, d.y, r, r * 2);
    }
  };
}

function textCrop(el, text, width) {
  if (typeof el.getSubStringLength !== "undefined") {
    el.textContent = text;
    var len = text.length;
    while (el.getSubStringLength(0, len--) > width) {}
    el.textContent = text.slice(0, len) + "...";
  } else if (typeof el.getComputedTextLength !== "undefined") {
    while (el.getComputedTextLength() > width) {
      text = text.slice(0, -1);
      el.textContent = text + "...";
    }
  } else {
    // the last fallback
    while (el.getBBox().width > width) {
      text = text.slice(0, -1);
      // we need to update the textContent to update the boundary width
      el.textContent = text + "...";
    }
  }
}

function radialLine(self) {
  var radius = self.data()[0].r,
    radiansStart = -1 / 2 * Math.PI,
    radiansEnd = 2 * Math.PI;

  var points = 50;

  var angle = d3.scaleLinear()
    .domain([0, points - 1])
    .range([radiansStart, radiansEnd]);

  var line = d3.radialLine()
    // .interpolate("basis")
    // .tension(0)
    .radius(radius)
    .angle(function(d, i) {
      return angle(i);
    });

  self.datum(d3.range(points))
    .attr("class", "line")
    .attr("d", line);
}

var parseTime = d3.timeParse("%Y/%m/%d %H:%M:%S %Z");

function zoomHandler(svg) {
  return d3.zoom()
    .extent(function() {
      var bbox = d3.select("#zoom-hull").node().getBoundingClientRect();
      return [
        [bbox.x, bbox.y],
        [bbox.x + bbox.width, bbox.y + bbox.height]
      ];
    })
    .scaleExtent([-100, 40])
    .on("zoom", function() {
      var translate = [d3.event.transform.x, d3.event.transform.y];
      var scale = d3.event.transform.k;
      svg
        .transition(1000)
        .attr("transform", "translate(" + translate + ")scale(" + scale + ")");
    });
}

function programmaticZoom(zoomHandler, svg, dim) {
  return function(self) {
    var offset = 100;
    var bbox = self.node().getBBox(),
      dx = bbox.width + offset,
      dy = bbox.height + offset,
      x = (bbox.x + bbox.x + bbox.width) / 2,
      y = (bbox.y + bbox.y + bbox.height) / 2,
      scale = Math.max(-20,
        Math.min(2.5, 1 / Math.max(dx / dim.width, dy / dim.height))),
      translate = [dim.width / 2 - scale * x,
        dim.height / 2 - scale * y
      ];

    zoomHandler.transform(svg,
      d3.zoomIdentity
      .translate(translate[0], translate[1])
      .scale(scale));
  };
}

function programmaticZoomCircle(zoomHandler, svg, dim) {
  return function(d) {
    console.log("d", d);
    var offset = 50;
    var dx = d.width + offset,
      dy = d.height + offset,
      x = (d.x),
      y = (d.y),
      scale = Math.max(-40, Math.min(8, 1 / Math.max(dx / dim.width, dy / dim.height))),
      translate = [dim.width / 2 - scale * x,
        dim.height / 2 - scale * y
      ];
    console.log(dx, dy, x, y, scale, translate);

    zoomHandler.transform(svg,
      d3.zoomIdentity
      .translate(translate[0], translate[1])
      .scale(scale));
  };
}
// function zoomTo(v) {
//     var k = diameter / v[2]; view = v;
//     node.attr("transform", function(d) {
//       return (d.x - v[0]) * k + "," + (d.y - v[1]) * k + ")"; });
//
//     zoomHandler.transform(svg,
//       d3.zoomIdentity
//       .translate(translate[0], translate[1])
//       .scale(scale));
//   }

var groupPath = function(nodes) {
  var fakePoints = [];
  nodes.forEach(function(element) {
    var offset = element.r;
    fakePoints = fakePoints.concat([
      // "0.7071" scale the sine and cosine of 45 degree for corner points.
      [(element.x), (element.y + offset)],
      [(element.x + (0.7071 * offset)), (element.y + (0.7071 * offset))],
      [(element.x + offset), (element.y)],
      [(element.x + (0.7071 * offset)), (element.y - (0.7071 * offset))],
      [(element.x), (element.y - offset)],
      [(element.x - (0.7071 * offset)), (element.y - (0.7071 * offset))],
      [(element.x - offset), (element.y)],
      [(element.x - (0.7071 * offset)), (element.y + (0.7071 * offset))]
    ]);
  });

  var hull = d3.polygonHull(fakePoints);
  if (hull === null) return null;
  return offsetInterpolate(15)(hull.reverse());
};
export {
  textCrop,
  innerCircleCollide,
  parseTime,
  rectCollide,
  zoomHandler,
  groupPath,
  programmaticZoom,
  programmaticZoomCircle
};
