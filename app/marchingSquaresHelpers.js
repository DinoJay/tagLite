import _ from "lodash";
import * as d3 from "d3";

// var color = d3.scale.category20();



// var hullcolor = d3.scale.category20();
//
// var hullcurve = d3.svg.line()
//   .interpolate("basis-closed")
//   .x(d => d.x)
//   .y(d => d.y);

function draw_marching_squares(callback, groups, isolevel = 0.044,
                                                          cell_size = 4) {
  // var isolevel = 0.0250;
  var epsilon = 0.00000001;
  var grid = {
    width: 300,
    height: 300
  };

  var set = []; //the current set for the bubble

  var edge_table = [
      0x0,     //0000,
      0x9,     //1001,
      0x3,     //0011
      0xa,     //1010
      0x6,     //0110,
      0xf,     //1111,
      0x5,     //0101
      0xc,     //1100
      0xc,     //1100
      0x5,     //0101
      0xf,     //1111,
      0x6,     //0110,
      0xa,     //1010
      0x3,     //0011
      0x9,     //1001,
      0x0     //0000
  ];

  var segment_table = [
      [-1,-1,-1,-1,-1],
      [0,3,-1,-1,-1],
      [1,0,-1,-1,-1],
      [1,3,-1,-1,-1],
      [2,1,-1,-1,-1],
      [2,1,0,3,-1],
      [2,0,-1,-1,-1],
      [2,3,-1,-1,-1],
      [3,2,-1,-1,-1],
      [0,2,-1,-1,-1],
      [1,0,3,2,-1],
      [1,2,-1,-1,-1],
      [3,1,-1,-1,-1],
      [0,1,-1,-1,-1],
      [3,0,-1,-1,-1],
      [-1,-1,-1,-1,-1]
  ];


  function vertex_interp(isolevel, p1, p2, valp1, valp2) {
    if ( Math.abs(isolevel - valp1) < epsilon ) { return p1; }
    if ( Math.abs(isolevel - valp2) < epsilon ) { return p2; }
    if ( Math.abs(valp1 - valp2) < epsilon ) { return p2; }
    var mu = (isolevel - valp1) / (valp2 - valp1);
    var p = {
      x: p1.x + mu * (p2.x - p1.x),
      y: p1.y + mu * (p2.y - p1.y)
    };
    return p;
  }

  function get_grid_cell(x, y) {
    var cell = {
      x: x,
      y: y,
      v: [
        {x: x, y: y},
        {x: x+cell_size, y: y},
        {x: x+cell_size, y: y+cell_size},
        {x: x, y: y+cell_size}
      ],
      val: [
        threshold(x, y),
        threshold(x+cell_size, y),
        threshold(x+cell_size, y+cell_size),
        threshold(x, y+cell_size)
      ],
      status:false
    };

    if (
      cell.val[0] < isolevel ||
      cell.val[1] < isolevel ||
      cell.val[2] < isolevel ||
      cell.val[3] < isolevel
      ) { cell.status = true; }

    return cell;

  }

  function polygonize(cell, isolevel) {
    var index = 0;
    if ( cell.val[0] < isolevel ) { index |= 1; }
    if ( cell.val[1] < isolevel ) { index |= 2; }
    if ( cell.val[2] < isolevel ) { index |= 4; }
    if ( cell.val[3] < isolevel ) { index |= 8; }

    if ( edge_table[index] === 0 ) {
      return []; // no segments here!
    }

    var vertlist = [
      {x:0, y:0},
      {x:0, y:0},
      {x:0, y:0},
      {x:0, y:0}
    ];

    if ( edge_table[index] & 1 ) {
      vertlist[0] = vertex_interp(isolevel,cell.v[0], cell.v[1], cell.val[0], cell.val[1]);
    }
    if ( edge_table[index] & 2 ) {
      vertlist[1] = vertex_interp(isolevel,cell.v[1], cell.v[2], cell.val[1], cell.val[2]);
    }
    if ( edge_table[index] & 4 ) {
      vertlist[2] = vertex_interp(isolevel,cell.v[2], cell.v[3], cell.val[2], cell.val[3]);
    }
    if ( edge_table[index] & 8 ) {
      vertlist[3] = vertex_interp(isolevel,cell.v[3], cell.v[0], cell.val[3], cell.val[0]);
    }

    var segments = [];
    for ( var i = 0; segment_table[index][i] != -1; i += 2 ) {
      segments.push({ a: vertlist[segment_table[index][i  ]],
                      b: vertlist[segment_table[index][i+1]]
                    });
    }

    return segments;
  }

  //graph.nodes dependence
  function threshold(x, y){
    var f = 0;
    for (var i = 0; i < set.length; i++) {
      var d = Math.sqrt(Math.pow(set[i].x - x, 2) + Math.pow(set[i].y - y, 2));
      var g_force = 1 / Math.pow(d, 2);
      f += g_force;
    }
    return f;
  }


  var iterationOfMarchingSquares = 0;
  var selectTetrisCells = null;
  var bubblePoints = [];
  var prevArrayOfArraysLength=[];
  var groupFillOpacity = 0.5;

  var tetrisIsOn = false;
  var tetrisOpacityMap = null;

  var minTestrisOpacity=0.25, maxTestrisOpacity=1;
  var tetrisOpacityRange = [minTestrisOpacity, maxTestrisOpacity];
    var groupedPoints = [];

  groups.forEach(g => {

    set = g.values; //graph.nodes.filter(function(x){return x.group==g;});
    // console.log("marching_squares g.set", g.set);

    bubblePoints = [];
    var tetriscells = [];
    for ( var i = 0; i < grid.width / cell_size; i += 1 ) {
      for ( var j = 0; j < grid.height / cell_size; j += 1 ) {
        var cell = get_grid_cell(i*cell_size, j*cell_size);

        if (cell.status) {
          // TODO: set[i].isolevel
          var segments = polygonize(cell, isolevel);

          // if(segments.length === 0) {
          //   console.log("segements", segments);
          // } else {
          //   tetriscells.push({
          //     x: cell.x,
          //     y: cell.y,
          //     val: d3.median(cell.val)
          //   });
          // }

          for (var k = 0; k < segments.length; k++ ) {
             bubblePoints.push({
               x: segments[k].b.x,
               y: segments[k].b.y,
               id: "i"+i+"j"+j+"k"+k+"g"+g.key,
               group: g.key
             });
             bubblePoints.push({
               x: segments[k].a.x,
               y: segments[k].a.y,
               id: "i"+i+"j"+j+"k"+k+"g"+g.key,
               group: g.key
             });
          }
        } //if(cell)
        else {
          tetriscells.push({
            x: cell.x,
            y: cell.y,
            val: d3.median(cell.val)
          });
        }
      } // j
    } // i

    var opacityExtent = d3.extent(tetriscells.map(function(d) {
      return d.val;
    }));

    if (tetrisIsOn){
      groupFillOpacity = 0;
      tetrisOpacityRange = [minTestrisOpacity, maxTestrisOpacity];
    }
    else{
      groupFillOpacity = 0.5;
      tetrisOpacityRange = [0, 0];
    }

    tetrisOpacityMap = d3.scaleLinear()
      .domain(opacityExtent)
      .range(tetrisOpacityRange);

    iterationOfMarchingSquares += 1;

    var sortedBubblePoints = sortBubblePoints(bubblePoints);

    var arrayOfArrays = splitSortedBubblePoints(sortedBubblePoints);

    g.path = arrayOfArrays;
    g.interTags = _.intersection(...g.values.map(d => d.tags));
    callback(g);
    // d3.select(".bubble-cont").selectAll(".bubble-"+g.key).remove();

    // // TODO: no hover possible
    // d3.select(".bubble-cont")
    //  .selectAll(".bubble-"+g.key) .data(arrayOfArrays)
    //   .enter()
    //   .append("g")
    //   .attr("class", "bubble-"+g.key)
    //   .insert("path", ":first-child")
    //     .attr("id", (d, i) => "co" + i)
    //     .attr("d", function(d){ return hullcurve(d); })
    //     .attr("fill", () => hullcolor(g.key))
    //      // .attr("stroke", "black")
    //      // .attr("stroke-width", "20px")
    //     .attr("stroke-linejoin", "round")
    //     .attr("opacity", groupFillOpacity);

  }); // g

  return groupedPoints;

  function sortBubblePoints(bubblePoints){
    if(bubblePoints.length === 0) return [];
    var subSets = [];
    var bubblePointsCopy = bubblePoints;
    var sortedBubblePoints = [];
    sortedBubblePoints.push(bubblePointsCopy[0]);
    bubblePointsCopy = bubblePointsCopy.slice(0, bubblePoints.length);
    var id = bubblePointsCopy[0].id;

    for (var i = 0 ; i < bubblePoints.length-1; i++){

        var shortestDistance = Infinity, shortestIndex=null;
        for (var j = 0 ; j < bubblePointsCopy.length; j++){
            //calculate distance
            var dist = computeDistance(sortedBubblePoints[i], bubblePointsCopy[j]);
            if(dist<shortestDistance){
                shortestIndex = j;
                shortestDistance = dist;
            }
        }
        //console.log('sd:'+shortestDistance);
        id = bubblePointsCopy[shortestIndex].id;

        sortedBubblePoints.push(bubblePointsCopy[shortestIndex]);
        bubblePointsCopy.splice(shortestIndex,1); //remove the element
    }

   //or just take the evens to approximate the bubble
    sortedBubblePoints = sortedBubblePoints
      .filter(function(x,i){
      return (i%2 === 0);
    });

    return sortedBubblePoints;
  }

  function splitSortedBubblePoints(sortedBubblePoints){
      var subSets = [];
      var lastSplit = 0;
      var thresholdDist = computeDistance({x:cell_size,y:cell_size},{x:0,y:0});
      for (var i = 0; i < sortedBubblePoints.length - 1; i++){

          if (computeDistance(sortedBubblePoints[i],
              sortedBubblePoints[i+1]) > thresholdDist){
              subSets.push(sortedBubblePoints.slice(lastSplit, i));
              lastSplit = i+1;
          }
      }
      if(lastSplit!=sortedBubblePoints.length){
        subSets.push(sortedBubblePoints.slice(lastSplit, sortedBubblePoints.length));
      }
      return subSets;
  }

  function squared(a){
    return Math.pow(a,2);
  }

  function computeDistance(a,b){
    return Math.pow( squared(a.x - b.x) + squared(a.y- b.y), 2 );
  }
}



export default draw_marching_squares;

