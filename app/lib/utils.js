import * as d3 from "d3";
import _ from "lodash";

function deepLinks(nodes, cutEdges) {
  var dLinks = _.flattenDeep(cutEdges.map(e => {
    var src, tgt;
    if (e.source.nodes.length > e.target.nodes.length) {
      src = e.source;
      tgt = e.target;
    }
    else {
      src = e.target;
      tgt = e.source;
    }
    // TODO: check
    if (src.comp === tgt.comp) return [];
    var srcComp = nodes.comps.find(d => d.id === src.comp);
    var tgtComp = nodes.comps.find(d => d.id === tgt.comp);
    if (_.intersection(srcComp.sets.map(d => d.key),
      tgtComp.sets.map(d => d.key)).length > 0) {
      return srcComp.nodes.map(s => {
        return tgtComp.nodes.reduce((acc, t)=> {
          if (_.intersection(s.tags, t.tags).length > 0) {
            acc.push({
              source: nodes.docs.find(n => n.id === s.id).index,
              target: nodes.docs.find(n => n.id === t.id).index
            });
          }
          return acc;
        }, []);
      });
    } else return [];
  }));
  return dLinks;
}

function aggrLinks(nodes) {
  var docLinks = [];
  nodes.docs.forEach(s => {
    var srcComp = nodes.comps.find(d => d.id === s.comp);
    if (srcComp === undefined) return;
    var srcSets = srcComp.sets.map(d => d.key);
    // var scomp = appliedComps.find(d => d.id === s.comp);
    // var sCompTags = tags
    nodes.docs.forEach(t => {
    var tgtComp = nodes.comps.find(d => d.id === t.comp);
    if (tgtComp === undefined) return;
    var tgtSets = tgtComp.sets.map(d => d.key);
      // var tcomp = appliedComps.find(d => d.id === s.comp);
      if (s.comp !== t.comp && _.intersection(srcSets, tgtSets).length > 0) {
      var filtered = docLinks.filter(l => l.source === s.index && l.target === t.index || l.source === t.index && l.target === s.index);
        if (filtered.length === 0)
        docLinks.push({
            id: s.index + t.index,
            source: s.index,
            target: t.index
        });
      }
    });
  });
  return _.uniqBy(docLinks, "id");
}

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


var parseTime = d3.timeParse("%Y/%m/%d %H:%M:%S %Z");
export {aggrLinks, deepLinks, parseTime, rectCollide};
