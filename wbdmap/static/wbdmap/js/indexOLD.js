var app = {};
var loading;

require(
[ 
	"dojo/parser", 
	"dojo/promise/all", 
	"dojo/_base/connect",
	"dojo/store/Memory",
	"dojo/data/ObjectStore",
	"dojox/grid/DataGrid",
	"esri/Color",
	"dojo/_base/array", 
	"dojo/dom", 
	"esri/config", 
	"esri/map", 
	"esri/geometry/Extent",
	"esri/graphic", 
	"esri/graphicsUtils", 
	"esri/symbols/SimpleFillSymbol",
	"esri/symbols/SimpleMarkerSymbol", 
	"esri/symbols/SimpleLineSymbol",
	"esri/layers/ArcGISDynamicMapServiceLayer",  
	"esri/layers/FeatureLayer",
	"esri/renderers/SimpleRenderer",
	"esri/tasks/query",
	"esri/tasks/QueryTask", 
	"esri/request",
	"dijit/layout/BorderContainer", 
	"dijit/layout/ContentPane",
	"dojo/domReady" /*removed !wbdmap/static/wbdmap/js/index ??? */
],
function(
	parser, 
	all, 
	connect, 
	Memory,
	ObjectStore,
	DataGrid,
	Color, 
	arrayUtils, 
	dom, 
	esriConfig, 
	Map, 
	Extent, 
	Graphic, 
	graphicsUtils, 
	SimpleFillSymbol, 
	SimpleMarkerSymbol, 
	SimpleLineSymbol, 
	ArcGISDynamicMapServiceLayer, 
	FeatureLayer,
	SimpleRenderer,
	Query, 
	QueryTask,
	esriRequest
)
{
	// create layout dijits
	parser.parse();
	// specify proxy for request with URL lengths > 2k characters
	//TODO
	esriConfig.defaults.io.proxyUrl = "/proxy/";
	esriConfig.defaults.io.corsDetection = true;
	esriConfig.defaults.io.httpsDomains.push("watersgeo.epa.gov");

	esriConfig.defaults.io.timeout = 50000; 
	// 
	app.map = new Map("map", {
		basemap: "topo",
		logo : false,
		center : [-106.41, 39.0], // longitude, latitude
		maxZoom: 14,
		minZoom: 1,
		zoom : 5
	});

	// add the results to the map
	var results_json = {};
	
	// HUC8 map server layer
	huc8_mapserver = "https://enviroatlas.epa.gov/arcgis/rest/services/Other/HydrologicUnits/MapServer/2";
	// HUC12 map server layer
	huc12_mapserver = "https://enviroatlas.epa.gov/arcgis/rest/services/Other/HydrologicUnits/MapServer/4";

	huc12_field_nm = "HUC_12";
	huc12_name_field_nm = "HU_12_Name";
	huc8_field_nm = "HUC8";
	huc8_name_field_nm = "HU_8_Name";

	// these are faster
	// HUC8 map server layer
	huc8_mapserver = "https://watersgeo.epa.gov/arcgis/rest/services/NHDPlus_NP21/WBD_NP21_Simplified/MapServer/2";
	// HUC12 map server layer
	huc12_mapserver = "https://watersgeo.epa.gov/arcgis/rest/services/NHDPlus_NP21/WBD_NP21_Simplified/MapServer/0";

	huc12_field_nm = "HUC_12";
	huc12_name_field_nm = "HU_12_NAME";
	huc8_field_nm = "HUC_8";
	huc8_name_field_nm = "HU_8_NAME";

	// HUC12 navigator
	navigator_url = "http://127.0.0.1:82/huc"
	
	var map_click_point;

	//timer
	var t0;

	loading = dom.byId("loadingImg");
	
	function showLoading() {
		esri.show(loading);
	}

	function hideLoading(error) {
		esri.hide(loading);
	}

	hideLoading();

	function initHUC12Grid()
	{
		gridHUC12 = new DataGrid({
			visibility: "hidden",
			autoHeight:true,
			selectable: true,
			structure: [
	        {name:"HUC12", field: "HUC12", width: "130px"},
	        {name:"HUC12 Name", field:"HU_12_NAME", width: "299px"},
	        ]
		}, "gridHUC12");
		gridHUC12.startup();
	    dijit.byId('gridHUC12').resize();
	    dojo.style(dom.byId("gridHUC12"), 'display', 'none');
	}
	
	function initNavigationGrid()
	{
		gridNavResults = new DataGrid({
			visibility: "hidden",
			autoHeight:true,
			selectable: true,
			structure: [
	        {name:"Attribute", field:"key", width: "200px"},
	        {name:"Value", field:"value", width: "228px"},
	        ]
		}, "gridNavResults");
		gridNavResults.startup();
	    dijit.byId('gridNavResults').resize();
	    dojo.style(dom.byId("gridNavResults"), 'display', 'none');
	}
	
	// query task and query for HUC12s
	app.qtHUC12 = new QueryTask(huc12_mapserver);
	app.qHUC12 = new Query();
	app.qHUC12.returnGeometry = true;
	app.qHUC12.outFields = [ "*" ];
	
	// query task and query for HUC8
	app.qtHUC8 = new QueryTask(huc8_mapserver);
	app.qHUC8 = new Query();	
	app.qHUC8.returnGeometry = true;
	app.qHUC8.outFields  = [ "*" ];

	app.map.on("click", executeQueries);
	
	initHUC12Grid();
	initNavigationGrid();
	
	dom.byId("results").innerHTML = 'Click the map to navigation upstream on the<br>Watershed Boundary Dataset Subwatersheds (HUC-12)';

	function executeQueries(e)
	{
		var exHUC12, exHUC8, promises;
		
		// to hide grid
		dojo.style(dom.byId("gridNavResults"), 'display', 'none');
		
		results_json = {};
		//dojo.destroy("grid");
		// create an extent from the mapPoint that was clicked
		// this is used to return features within 2 pixel of the click point
		map_click_point = e.mapPoint;
		var pxWidth = app.map.extent.getWidth() / app.map.width;
		var padding = 1 * pxWidth;
		map_click_pointGeom = new Extent({
			"xmin" : map_click_point.x - padding, "ymin" : map_click_point.y - padding,
			"xmax" : map_click_point.x + padding, "ymax" : map_click_point.y + padding,
			"spatialReference" : map_click_point.spatialReference
		});
		
		add_click_point_graphic(map_click_point);
		dojo.style(dom.byId("gridHUC12"), 'display', 'none');
		dom.byId("results").innerHTML = 'Searching HUC12s using mouse click ...';
		
		// use the 'map_click_pointGeom' for the initial query
		app.qHUC12.geometry = map_click_pointGeom;
		app.qHUC8.geometry = map_click_pointGeom;

		exHUC12 = app.qtHUC12.execute(app.qHUC12);
		
		exHUC8  = app.qtHUC8.execute(app.qHUC8);

		// send these off for processing
		promises = all([ exHUC12 ]); // , exHUC8
		
		promises.then(handleQueryResults);
		
		
		
		console.log("++++ user clicked map. running initial HUC12 query ++++");
	}
	
	function handleQueryResults(results)
	{
		var featHUC12, featHUC8;
		
		var length_results = results.length;
		
		console.log("initial HUC12 query finished: ", results);
		dom.byId("results").innerHTML = 'Processing Results ...';
		
		// results from deferred lists are returned in the order they were created
		if ( results[0].hasOwnProperty("features") )
		{
			if (results[0].features.length == 0)
			{
				console.log("HUC12s query failed to return any features.");
			}
			else if (results[0].features[0].attributes.hasOwnProperty("HUC_12"))
			{
				var huc12_feature_count = results[0].features.length;
				console.log("initial HUC12 query succeeded and found " + huc12_feature_count + " features");
			}
			featHUC12 = results[0].features;
		}
		else
		{
			console.log("HUC12s query failed.");
		}
		
		if ( length_results > 1 && results[1].hasOwnProperty("features") )
		{
			if (results[1].features.length == 0)
			{
				console.log("HUC8s query failed to return any features.");
			}
			else if (results[1].features[0].attributes.hasOwnProperty(huc8_field_nm)) /*todo: check if this has changed to HUC_8 */
			{
				console.log("HUC8s query succeeded.");
			}
			featHUC8  = results[1].features;
		}
		else if ( length_results > 1)
		{
			console.log("HUC8s query failed.");
		}

		if (featHUC12.length > 0)
		{
			app.map.graphics.clear();
		}
		
		// put the users click point back on the map
		add_click_point_graphic(map_click_point);
		

		
		if (featHUC12.length > 0)
		{
			app.map.setExtent(graphicsUtils.graphicsExtent(featHUC12));
		}
		
		var huc_id = '';
		var huc_nm = '';
		arrayUtils.forEach(featHUC12, function(feat)
		{
			feat.setSymbol(huc12_symbol());
			app.map.graphics.add(feat);
			
			if (! results_json.hasOwnProperty('huc12'))
			{
				results_json.huc12 = [];
			}
			
			// sensitive to name of HUC12 field
			huc_id = feat.attributes.HUC_12;
			// huc_nm = feat.attributes.HU_12_NAME; /*TODO: check for HU_12_NAME/Name */

			results_json.huc12.push({
				'HUC12' : huc_id, 'HU_12_NAME' : feat.attributes[huc12_name_field_nm]
			});
			
			huc12_tx = feat.attributes.HUC_12 + ' ' + feat.attributes[huc12_name_field_nm]

			add_label(feat.geometry.getExtent().getCenter(), huc12_tx)
			
		});
		
		var click_again_tx = '';
		
		if (featHUC12.length == 1)
		{
			if (featHUC12.length == 1)
			{
				results_json.huc12.push([ 'NAVIGATING UPSTREAM\n<img src=/wbdmap/images/hourglass.gif />' ]);
			}
			
			//app.map.setExtent(graphicsUtils.graphicsExtent(featHUC8));
			
			arrayUtils.forEach(featHUC8, function(feat)
			{
				huc8_tx = feat.attributes[huc8_field_nm] + ' ' + feat.attributes.HU_8_Name; /*TODO: check for field names */

				add_huc8_label(feat.geometry.getExtent().getCenter(), huc8_tx);
				
				feat.setSymbol(huc8_symbol());
				app.map.graphics.add(feat);
				
				if (! results_json.hasOwnProperty('huc8'))
				{
					results_json.huc8 = [];
				}
				results_json.huc8.push({
					'HUC8' : feat.attributes[huc8_field_nm], 'HU_8_NAME' : feat.attributes.HU_8_Name
				});
			});		

			showLoading();
			
			// call to get HUC12 Upstream navigation results - This is a REST service - NOT GIS

			var request = esriRequest({
				  url: navigator_url + '/' + huc_id + '/upstream/?format=json',
				  // content: {
				  //   code: huc_id
				  // },
				  handleAs: "json"
				});

			console.log("++ wbd navigation started for huc12 " + huc_id + " " + huc_nm);
			var performance = window.performance;
			t0 = performance.now();
			request.then(upstreamNavigationSucceeded, upstreamNavigationFailed);
		}
		else if (featHUC12.length > 1)
		{
			console.log("click again to select a single HUC12 to allow navigation");
			click_again_tx = '<div>Click on only one of the highlighted HUC-12 subwatersheds to navigate upstream.</div>';
		}
		else
		{
			click_again_tx = '<div style="color: red";>Click somewhere within the US boundary to find a Subwatershed (HUC-12) to navigate/</div>';
		}

		dom.byId("results").innerHTML = click_again_tx;
		
		tableResults(results_json);
		dojo.style(dom.byId("gridHUC12"), 'display', '');
		
		//
		// this is using 'data' - the results of the REST query - NOT ArcGIS
		//
		function upstreamNavigationSucceeded(data) 
		{

			var t1 = performance.now();
			console.log("++ wbd navigation finished in " + (t1 - t0).toFixed(3) + "ms");

			huc_json = results_json.huc12;
			huc_json.pop();
			
			//data['huc8'] = data.huc12.value.substring(0, 8);
			huc12_ids_len = data.navigation_data.results.upstream_hu12_list_length;
			if (huc12_ids_len > 0)
			{

				
				// get a list of the HUC8s for HUC12s that were found - these will be shown on the map
				var huc8_ids = [];
				arrayUtils.forEach(data.navigation_data.results.upstream_hu12_list, function(huc12_id)
				{
					var huc8_id = huc12_id.substring(0, 8);
					// don't add the HUC8 that contains the user clicked HUC12
					if (huc8_id == data.parent_data.huc_code.substring(0, 8))
					{
						return;
					}
					if (huc8_ids.indexOf(huc8_id) === -1)
					{ 
						huc8_ids.push(huc8_id)
					}
				});
				data['upstream_huc8_count_nu'] = {};
				data['upstream_huc8_count_nu']['value'] = huc8_ids.length;
				
				console.log("there are " + huc12_ids_len + " HUC12s and " + huc8_ids.length + " HUC8s upstream");

				// now send off the HUC12 query again, this time with a list of all HUC8s just created
				// there is a limit of how many huc12_ids can be included.  it might be line length of the query
				// it seems that the magic number is 90
				var huc12_ids = []
				var deferred_queries = [ ];
				
				if (dom.byId("show_all_huc12").checked)
				{
					huc12_ids =	closest_slice(data.navigation_data.results.upstream_hu12_list, 90, data.parent_data.huc_code);
					
					var i,j,temparray,chunk = 90;
					for (i=0,j=data.navigation_data.results.upstream_hu12_list.length; i<j; i+=chunk)
					{
					    temparray = data.navigation_data.results.upstream_hu12_list.slice(i,i+chunk);
					    
					    // do whatever
						var query12 = new Query();
						query12.where = "HUC_12 in ('" + temparray.join("','") + "')";
						query12.returnGeometry = true;
						query12.outFields  = [ "*" ];
						
						app.qtHUC12 = new QueryTask(huc12_mapserver);
						var exHUC12 = app.qtHUC12.execute(query12);
						
						deferred_queries.push(exHUC12);					    
					}
					console.log("running " + deferred_queries.length + " HUC12 GIS queries");
				}
				else // this is for 'show hu8s only
				{
					huc12_ids = carefully_slice(data.navigation_data.results.upstream_hu12_list, 90, data.parent_data.huc_code);
					
					var query12 = new Query();
					query12.where = "HUC_12 in ('" + huc12_ids.join("','") + "')";
					query12.returnGeometry = true;
					query12.outFields  = [ "HUC_12,HU_12_Name" ];
					
					app.qtHUC12 = new QueryTask(huc12_mapserver);
					exHUC12 = app.qtHUC12.execute(query12);
					
					deferred_queries.push(exHUC12);
				}
				var huc12_queries_count = deferred_queries.length;
				
				if (huc8_ids.length > 0) //  & ! dom.byId("termsCheck").checked)
				{
					var query8 = new Query();
					query8.where = huc8_field_nm + " in ('" + huc8_ids.join("','") + "')";
					query8.returnGeometry = true;
					query8.outFields  = [ "*" ];
		
					app.qtHUC8 = new QueryTask(huc8_mapserver);
					exHUC8 = app.qtHUC8.execute(query8);
					
					deferred_queries.push(exHUC8);
				}
				promises = all(deferred_queries);
				
				promises.then(handleUpstreamNavigationQueryResults);
				
				t0 = performance.now();
				console.log("++ gis queries started. " + huc12_queries_count + " HUC12 and 1 HUC8 upstream queries");
			}
			else
			{
				var query12 = new Query();
				query12.where = "HUC_12 = '" + data.huc12 + "'";
				query12.returnGeometry = true;
				query12.outFields  = [ "*" ];

				app.qtHUC12 = new QueryTask(huc12_mapserver);
				exHUC12 = app.qtHUC12.execute(query12);
				promises = all([ exHUC12 ]); //
				
				promises.then(handleUpstreamNavigationQueryResults);
				
				console.log("running single HUC12 Upstream queries");
			}
			huc_json.push({'NAVIGATION_RESULTS': data });
			
			tableNavigationResults(data);
			// show grid
			dojo.style(dom.byId("gridNavResults"), 'display', '');
			
			results_json.huc12 = huc_json;
			if (featHUC12.length == 1)
			{
				results_json.huc12.push('GETTING GIS RESULTS <img src=/wbdmap/images/hourglass.gif />');
			}
			str = 'JSON: ' + JSON.stringify(results_json, null, 4);

			dom.byId("results").innerHTML = '';
		}

		function upstreamNavigationFailed(error) {
			hideLoading();
			console.log("HUC12 Upstream Navigation Failed: ", error.message);
			results_json['HUC12_Upstream_Navigation'] = {'NAVIGATION_FAILED': error.message};
		}
	}
	

	
	function handleUpstreamNavigationQueryResults(Qresults)
	{
		var t1 = performance.now();
		console.log("++ gis queries finished in " + (t1 - t0).toFixed(3) + "ms");
		//console.log("exHUC12 queries finished: ", Qresults);
		
		huc_json = results_json.huc12;
		huc_json.pop();

		//sorry
		var huc12_headwaters = results_json['huc12'][1]["NAVIGATION_RESULTS"]["navigation_data"]["results"]["upstream_hu12_headwaters_list"];

		str = 'JSON: ' + JSON.stringify(results_json, null, 4);
		dom.byId("results").innerHTML = ""; // "<pre>" + str + '</pre>'; //  + tableResults(results_json.huc12);
		
		if (!Qresults[0].hasOwnProperty("features"))
		{
			console.log("exHUC12 query failed.");
		}
		
		if (Qresults.length > 1)
		{
			if (!Qresults[Qresults.length - 1].hasOwnProperty("features"))
			{
				console.log("exHUC8s query failed.");
			}		
			featHUC8 = Qresults[Qresults.length - 1].features;

			app.map.setExtent(graphicsUtils.graphicsExtent(featHUC8));
			
			arrayUtils.forEach(featHUC8, function(feat)
			{
				//huc8_tx = feat.attributes.HUC_8 + ' ' + feat.attributes.HU_8_NAME;
				//add_huc8_label(feat.geometry.getExtent().getCenter(), huc8_tx);


				feat.setSymbol(huc8_symbol());
				
				app.map.graphics.add(feat);
			});	
			console.log("added " + featHUC8.length + " HUC8 features to map");
		}
		else if (Qresults.length == 1)
		{
			featHUC12 = Qresults[0].features;

			if (featHUC12.length > 0){
				app.map.setExtent(graphicsUtils.graphicsExtent(featHUC12));
			}

		}
		
		//featHUC12 = results[0].features;
		var huc12_feature_count = 0;
		arrayUtils.forEach(Qresults, function(featHUC12)
		{
			// this changed at some time 2019-04-26
			// if (featHUC12.hasOwnProperty('displayFieldName') & featHUC12['displayFieldName'] == "HU_12_NAME")
			if (featHUC12.features.length > 0
					&& featHUC12.features[0].attributes.hasOwnProperty([huc12_name_field_nm])) /* diff on waters and enviro */
			{
				//console.log('in HU_12_NAME');
				var myHUC12s = featHUC12;
				for (i=0; i < myHUC12s.features.length; i += 1) 
				{
					huc12_feature_count += 1;

					var sym = huc12_symbol();

					if (huc12_headwaters.includes(myHUC12s.features[i]['attributes'][huc12_field_nm])){
						sym = huc12_headwater_symbol();
					}

					myHUC12s.features[i].setSymbol(sym);
							
					app.map.graphics.add(myHUC12s.features[i]);
						
				}
			}			


		});

		console.log("added " + huc12_feature_count + " HUC12 features to map");

		hideLoading();
		
		// put the users click point back on the map
		add_click_point_graphic(map_click_point);
	}
	
	function tableResults(data)
	{
        // create an object store
		var results_data = [];
		for (var i in data.huc12)
		{
			values = data.huc12[i];
			
			if (values.hasOwnProperty("HUC12")) //TODO
			{
				
				results_data.push(values);
			}
		}
        var objectStore = new Memory({
            data: results_data
        });
        gridStore = new dojo.data.ObjectStore({objectStore: objectStore});
        gridHUC12.store = gridStore;

        gridHUC12.render();
        dojo.style(dom.byId("gridHUC12"), 'display', '');
        dijit.byId('gridHUC12').resize();
	}

	// TBD This is how the data looked in the older version of the navigtator
	// "huc12": {
	// 	"name": "HUC12",
	// 	"value": "110600060601"
	// },
	// "area_sq_km": {
	// 	"units": "km2",
	// 	"name": "HUC12 Area",
	// 	"value": "111.23",
	// 	"format": ".2f"
	// },
	// "results_length": 1354,
	// 	"us_water_area_sq_km": {
	// 	"units": "km2",
	// 	"name": "Upstream HUC12 water area",
	// 	"value": "1,144",
	// 	"format": ".2f"
	// },
	// "upstream_huc8_count_nu": {
	// 	"name": "Upstream HUC8 Count",
	// 	"value": 0
	// },
	// "upstream_count_nu": {
	// 	"name": "Upstream HUC12 Count",
	// 	"value": "1,353"
	// },
	// "huc12_name": {
	// 	"name": "HUC12 Name",
	// 	"value": "Little Drum Creek-Arkansas River"
	// },
	function tableNavigationResults(data)
	{
		// things are formatted in the REST service - but this is setting the contents and order
		attribute_list = [
			 'area_sq_km', 
			 'water_area_sq_km',
			 'headwater_bool',
			 'terminal_bool',
			 'terminal_huc12_ds',
			 'terminal_outlet_type_code',
			 'hu12_ds_count_nu',
			 // 'upstream_count_nu',
			 // 'us_area_sq_km',
			 // 'us_water_area_sq_km',
			 // 'huc8',
			 // 'upstream_huc8_count_nu',
			];

		var results_data = [];
		attribute_list.forEach(function(key) {
			if (data.parent_data.hasOwnProperty(key))
			{
				results_data.push({'key': key, 'value': data.parent_data[key]});

				// result_data = data.parent_data[key];
				//
				// value_display = result_data['value'];
				//
				// if (result_data.hasOwnProperty('units'))
				// {
				// 	value_display = value_display + ' ' + result_data['units']
				// }
				// results_data.push({'key': result_data['name'], 'value': value_display});
			}
		});

        // create an object store
        var objectStore = new Memory({
            data: results_data
        });
        results2Store = new dojo.data.ObjectStore({objectStore: objectStore});
        gridNavResults.store = results2Store;
        
		// show grid
        gridNavResults.render();
		dojo.style(dom.byId("gridNavResults"), 'display', '');
        dijit.byId('gridNavResults').resize();
	}
});

function carefully_slice(ids, max_count_nu, target_huc_id)
{
	if (ids.length <= max_count_nu)
	{
		return ids
	}

	var returned_ids = [];
	
	//
	// just return the ones that are in the same huc8 as the 'target' huc
	//
	for (var idx in ids)
	{
		id = ids[idx];
	
		if (id.slice(0, 8) == target_huc_id.slice(0, 8))
		{
			//console.log('matched id==' + id.slice(0, 8) + ' for target_huc_id==' + target_huc_id);
			returned_ids.push(id);
			
			if (returned_ids.length == max_count_nu)
			{
				break;
			}
		}
	}
	return (returned_ids);
};

function closest_slice(ids, max_count_nu, target_huc_id)
{
	if (ids.length <= max_count_nu)
	{
		return ids;
	}

	var returned_ids = [];
	
	// this loop gets the hucs that most look like the 'target' huc (the one the user clicked)
	// it is superceded by the one above it
	for (i = 0; i < target_huc_id.length; i++)
	{
		for (var idx in ids)
		{
			id = ids[idx];
		
			if (id.slice(0, 12 - i) == target_huc_id.slice(0, 12 - i))
			{
				//console.log('matched id==' + id.slice(0, 12 - i) + ' for target_huc_id==' + target_huc_id);
			
				// fix this issue here # buggy_huc12 101600102004  the bug is in the HUC coverage, not the routing tables.
				//if (id == 101600112004)
				//{
				//	id = 101600102004;
				//}
				returned_ids.push(id);
				if (returned_ids.length == max_count_nu)
				{
					break;
				}
			}
		}
		if (returned_ids.length == max_count_nu)
		{
			break;
		}
	}
	return (returned_ids);
};

function add_click_point_graphic(point)
{
	// add a simple marker graphic at the location where the user clicked on the map.
	var pointSymbol = new esri.symbol.SimpleMarkerSymbol(
			esri.symbol.SimpleMarkerSymbol.STYLE_CROSS, 22,
							new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID,
							new dojo.Color([ 0, 128, 0 ]), 4)
							);
	var clickPointGraphic = new esri.Graphic(point, pointSymbol);
	app.map.graphics.add(clickPointGraphic);
};

function huc12_symbol()
{
	var sfs = new esri.symbol.SimpleFillSymbol({
		  "type": "esriSFS",
		  "style": "esriSFSSolid",
		  "color": [255, 170, 0, 100]
		});
	var sls = new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_DASHDOT, new dojo.Color([0,0,0, 50]), 1);
	
	sfs.setOutline(sls);
	
	return sfs;
}

function huc12_headwater_symbol()
{
	var sfs = new esri.symbol.SimpleFillSymbol({
		  "type": "esriSFS",
		  "style": "esriSFSSolid",
		  "color": [105, 170, 170, 100]
		});
	var sls = new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_DASHDOT, new dojo.Color([0,0,0, 50]), 1);

	sfs.setOutline(sls);

	return sfs;
}

function huc8_symbol()
{
	var sfs = new esri.symbol.SimpleFillSymbol({
		  "type": "esriSFS",
		  "style": "esriSFSSolid",
		  "color": [255,0, 0,40]
		});
	var sls = new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_DASHDOTDOT, new dojo.Color([0,0,0, 50]), 0.5);
	
	sfs.setOutline(sls);
	
	return sfs;
}

function add_huc8_label(point, label_text)
{
	//Add HUC12 ID to each feature
	var hucFont = new esri.symbol.Font("12pt",
	  esri.symbol.Font.STYLE_NORMAL,
	  esri.symbol.Font.VARIANT_NORMAL,
	  esri.symbol.Font.WEIGHT_BOLD, "Arial");
	
	var hucTextSymbol = new esri.symbol.TextSymbol(label_text);
	hucTextSymbol.setColor(new dojo.Color([0, 0, 0]));
	
	hucTextSymbol.setAlign(esri.symbol.TextSymbol.ALIGN_MIDDLE);
	hucTextSymbol.setFont(label_text);

	var graphic = new esri.Graphic(point, hucTextSymbol);
	app.map.graphics.add(graphic);
}

function add_label(point, label_text)
{
	//Add HUC12 ID to each feature
	var hucFont = new esri.symbol.Font("14pt",
	  esri.symbol.Font.STYLE_NORMAL,
	  esri.symbol.Font.VARIANT_NORMAL,
	  esri.symbol.Font.WEIGHT_BOLD, "Arial");
	
	var hucTextSymbol = new esri.symbol.TextSymbol(label_text);
	hucTextSymbol.setColor(new dojo.Color([0, 0, 0]));
	
	hucTextSymbol.setAlign(esri.symbol.TextSymbol.ALIGN_MIDDLE);
	hucTextSymbol.setFont(label_text);

	var graphic = new esri.Graphic(point, hucTextSymbol);
	app.map.graphics.add(graphic);
}


// all features in the layer will be visualized with
// a 6pt black marker symbol and a thin, white outline
//var featureLayer = new FeatureLayer(huc8_mapserver);
//var renderer = new SimpleRenderer({
//  symbol: new SimpleLineSymbol(    SimpleLineSymbol.STYLE_DASH,
//		    new Color([255,0,0]),
//		    3)
//	});
//featureLayer.setRenderer = renderer;

//var featureLayer2 = new esri.layers.FeatureLayer({
//	url: "https://watersgeo.epa.gov/arcgis/rest/services/OW/WBD_WMERC/MapServer/2"
//
//
//});
//app.map.addLayer(featureLayer);