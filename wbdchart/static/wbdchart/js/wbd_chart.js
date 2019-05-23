var margin = {top: 20, right: 120, bottom: 20, left: 120}; // [ 20, 20, 20, 20 ];
var width = 1280 - margin.right - margin.left;
var height = 650 - margin.top - margin.bottom;
var i = 0;
var root;

var tree = d3.layout.tree().size([ height, width ]);

var huc_service = "http://localhost/wbd-cgi/index.py"

huc_service = "http://127.0.0.1:82/hu2/"

var diagonal = d3.svg.diagonal().projection(function(d)
{
    return [ d.y, d.x ];
});




// end bad idea

var vis = d3.select("#body").append("svg:svg")
    .attr("width", width + margin.right + margin.left)
    .attr("height", height + margin.top + margin.bottom)
    .append("svg:g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var zoom = function() {
    var scale = d3.event.scale,
        translation = d3.event.translate,
        tbound = -height * scale,
        bbound = height * scale,
        lbound = (-width + margin.right) * scale,
        rbound = (width - margin.left) * scale;
    // limit translation to thresholds
    translation = [
        Math.max(Math.min(translation[0], rbound), lbound),
        Math.max(Math.min(translation[1], bbound), tbound)
    ];
    vis.attr("transform", "translate(" + translation + ")" + " scale(" + scale + ")");
}

d3.json(huc_service, function(json)
{
    root = json;
    root.children = root.navigation_data.results.hu_data; // in api changed children to results
    root.x0 = height / 2;
    root.y0 = 0;

    function toggleAll(d)
    {
        if (d.children)
        {
            d.children.forEach(toggleAll);
            toggle(d);
        }
    }

    // Initialize the display to show first set of children.
    root.children.forEach(toggleAll);

    update(root);
});

function update(source)
{
    var duration = d3.event && d3.event.altKey ? 5000 : 500;

    // Compute the new tree layout.
    var nodes = tree.nodes(root).reverse();

    // Normalize for fixed-depth.
    nodes.forEach(function(d)
    {
        switch(d.depth) {
            case 1:
                d.y = 100
                break;
            case 2:
                d.y = 280
                break;
            case 3:
                d.y = 520
                break;
            case 4:
                d.y = 760
                break;
            case 5:
                d.y = 1020
                break;
            default:
                d.y = 0
        }
    });

    // Update the nodes…
    var node = vis.selectAll("g.node").data(nodes, function(d)
    {
        return d.id || (d.id = ++i);
    });

    // Enter any new nodes at the parent's previous position.
    var nodeEnter = node.enter().append("svg:g").attr("class", "node").attr("transform",
            function(d)
            {
                return "translate(" + source.y0 + "," + source.x0 + ")";
            }).on("click", function(d)
    {
        if (d3.event.shiftKey)
        {
            navigationdata(d);
        }
        else
        {
            toggle(d);
            update(d);
        }
    });

    nodeEnter.append("svg:circle").attr("r", 1e-6).style("fill", function(d)
    {
        return d._children ? "lightsteelblue" : "#fff";
    });

    nodeEnter.append("svg:text").attr("x", function(d)
    {
        return d.children || d._children ? -10 : 10;
    }).attr("dy", ".35em").attr("text-anchor", function(d)
    {
        return d.children || d._children ? "end" : "start";
    }).text(function(d)
    {
        return d.long_name || d.huc_code + " " + d.name;
    }).style("fill-opacity", 1e-6);

    // Transition nodes to their new position.
    var nodeUpdate = node.transition().duration(duration).attr("transform", function(d)
    {
        return "translate(" + d.y + "," + d.x + ")";
    });

    nodeUpdate.select("circle").attr("r", 4.5).style("fill", function(d)
    {
        return d._children ? "lightsteelblue" : "#fff";
    });

    nodeUpdate.select("text").style("fill-opacity", 1);

    // Transition exiting nodes to the parent's new position.
    var nodeExit = node.exit().transition().duration(duration).attr("transform",
            function(d)
            {
                return "translate(" + source.y + "," + source.x + ")";
            }).remove();

    nodeExit.select("circle").attr("r", 1e-6);

    nodeExit.select("text").style("fill-opacity", 1e-6);

    // Update the links…
    var link = vis.selectAll("path.link").data(tree.links(nodes), function(d)
    {
        return d.target.id;
    });

    // Enter any new links at the parent's previous position.
    link.enter().insert("svg:path", "g").attr("class", "link").attr("d", function(d)
    {
        var o = {
            x : source.x0, y : source.y0
        };
        return diagonal({
            source : o, target : o
        });
    }).transition().duration(duration).attr("d", diagonal);

    // Transition links to their new position.
    link.transition().duration(duration).attr("d", diagonal);

    // Transition exiting nodes to the parent's new position.
    link.exit().transition().duration(duration).attr("d", function(d)
    {
        var o = {
            x : source.x, y : source.y
        };
        return diagonal({
            source : o, target : o
        });
    }).remove();

    // Stash the old positions for transition.
    nodes.forEach(function(d)
    {
        d.x0 = d.x;
        d.y0 = d.y;
    });

    d3.select("svg")
        .call(d3.behavior.zoom()
        .scaleExtent([0.5, 5])
        .on("zoom", zoom));
}

function navigationdata(d)
{
    var e = document.getElementById("navigation_direction");
    var direction = e.options[e.selectedIndex].value;

    //var direction = 'upstream';
    // var url = 'hu' + length(d.code).toString() + '/' + d.code + '/drilldown/';
    var url = '/huc/' + d.huc_code + '/drilldown/';
    d3.json(url, function(json)
    {
        len_comids = json.results_length;
        if (direction == 'downstream')
        {
            alert ("Navigated HUC12 " + d.huc_code + " Downstream distance is " + json.distance + " km., there are " + len_comids + " downstream HUC12s==" + json.comids);
        }
        else
        {
            alert ("Navigated HUC12 " + d.huc_code + " Upstream area is " + json.upstream_area + " km2., there are " + len_comids + " upstream HUC12s==" + json.comids);
        }
    });
}

// make the table
function tabulate(data, columns) {
    var table = footer_tx.append('table')
    var thead = table.append('thead')
    var	tbody = table.append('tbody');

    // append the header row
    thead.append('tr')
      .selectAll('th')
      .data(columns).enter()
      .append('th')
        .text(function (column) { return column; });

    // create a row for each object in the data
    var rows = tbody.selectAll('tr')
      .data(data)
      .enter()
      .append('tr');

    // create a cell in each row for each column
    var cells = rows.selectAll('td')
      .data(function (row) {
        return columns.map(function (column) {
          return {column: column, value: row[column]};
        });
      })
      .enter()
      .append('td')
        .text(function (d) { return d.value; });

  return table;
};

function makeTable(){
    return 1;
}

function toggle(d)
{

    var footer_tx = d3.select("#footer").text(d.huc_code + " " + d.name);
    // footer_tx.append(d.name + '(hello km2)')

    if (d.area_sq_km)
    (
        // footer_tx.append(d.name + '(' + d.area_sq_km + ' km2)')
        // var table_plot;
        // table_plot = makeTable();

        footer_tx = d3.select("#footer").text(d.name + '(' + d.area_sq_km + ' km2)')

        //TODO
        // table_plot = makeTable().datum().sortBy('pval', true).filterCols(['col', 'x', 'y']);
        //
        // d3.select('#container').call(table_plot);
        //
        // // render the table(s)
        // tabulate(data, ['date', 'close']); // 2 column table

    )

    if (!d.children && !d._children && d.huc_code.length.toString() > 8 && d.huc_code.length < 12)
    {
        navigationdata(d);
    }
    else if (!d.children && !d._children && d.huc_code && d.huc_code.length.toString() < 12)
    {
        var url = '/huc/' + d.huc_code + '/drilldown/?page_size=10000';

        var childObjects;

        if(url)
        {
            d3.json(url, function(json)
            {

                //childObjects = json['children'];
                // childObjects = json['results'];
                childObjects = json.navigation_data.results.hu_data;
                childObjects.forEach(function(node)
                {
                    if (node.name != d.name)
                    {
                        (d._children || (d._children = [])).push(node);
                    }
                });

                if (d.children)
                {
                    d._children = d.children;
                    d.children = null;
                }
                else
                {
                    d.children = d._children;
                    d._children = null;
                }
                update(d);

            });
        }
    }
    else
    {
        if (d.children)
        {
            d._children = d.children;
            d.children = null;
        }
        else
        {
            d.children = d._children;
            d._children = null;
        }
        update(d);
    }

}
