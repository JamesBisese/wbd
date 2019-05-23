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
	"dojo/dnd/Moveable",
	"esri/Color",
	"dojo/_base/array",
	"dojo/dom", 
	"esri/config", 
	"esri/map",
	"esri/geometry/Point",
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
	"dojo/domReady"
],
function(
	parser, 
	all, 
	connect, 
	Memory,
	ObjectStore,
	DataGrid,
	Moveable,
	Color, 
	arrayUtils, 
	dom, 
	esriConfig, 
	Map,
	Point,
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
	esriConfig.defaults.io.httpsDomains.push("127.0.0.1:86");
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

	// HUC12 navigator - defined in urls.js (or urls_production.js)
	navigator_url = NAVIGATOR_URL;
	
	var map_click_point;
	var map_click_huc_code;

	var hu12_headwater_list = [];

	//timer
	var t0;

	loading = dom.byId("loadingImg");
	
	function showLoading() {
		//esri.show(loading);
	}

	function hideLoading(error) {
		//esri.hide(loading);
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
	        {name:"Navigation Attribute", field:"key", width: "200px"},
	        {name:"Value", field:"value", width: "228px"},
	        ]
		}, "gridNavResults");
		gridNavResults.startup();
	    dijit.byId('gridNavResults').resize();
	    dojo.style(dom.byId("gridNavResults"), 'display', 'none');
	}

	function initAttributeGrid()
	{
		gridAttributeResults = new DataGrid({
			visibility: "hidden",
			autoHeight:true,
			selectable: true,
			structure: [
	        {name:"HU Attribute", field:"key", width: "200px"},
	        {name:"Value", field:"value", width: "228px"},
	        ]
		}, "gridAttributeResults");
		gridAttributeResults.startup();
	    dijit.byId('gridAttributeResults').resize();
	    dojo.style(dom.byId("gridAttributeResults"), 'display', 'none');
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

	// var widBox = dom.byId("controls_h3");
	// if (widBox != null)
	// {
	// 	var dnd = new Moveable(widBox, 5, false);
	// }
	  // on(dom.byId("controls"), "click", function(){
		// var dnd = new Moveable(dom.byId("dndOne"));
	  // });

	app.map.on("click", executeQueries);

	dojo.query("#navigation_huc_code").onmousedown(function (e) {
		dojo.query("#navigation_huc_code").focus();
	});

	dojo.query("#navigation_huc_code").onkeyup(huc_code_Search);
	// $("#navigation_huc_code").on("change", huc_code_Search);

	function huc_code_Search(evnt){
		var huc_code = evnt.target.value;
		if (huc_code.length == 12){
			alert("hu12 huc_code==" + huc_code);
			executeHUCSearch(huc_code)
		}
		if (huc_code.length == 8){
			alert("hu8 huc_code==" + huc_code);
			executeHUCSearch(huc_code)
		}

	}

	initHUC12Grid();
	initNavigationGrid();
	initAttributeGrid();
	NProgress.configure({ parent: '#thin_blue_line' });
	dom.byId("results").innerHTML = 'Click the map to navigation upstream on the<br>Watershed Boundary Dataset Subwatersheds (HUC-12)';

	function executeHUCSearch(huc_code)
	{
		var exHUC12, exHUC8, promises;

		// to hide grid
		dojo.style(dom.byId("gridNavResults"), 'display', 'none');
		dojo.style(dom.byId("gridAttributeResults"), 'display', 'none');

		results_json = {};
		//dojo.destroy("grid");
		// create an extent from the mapPoint that was clicked
		// this is used to return features within 2 pixel of the click point

		NProgress.start();

		// map_click_point = e.mapPoint;
		// var pxWidth = app.map.extent.getWidth() / app.map.width;
		// var padding = 1 * pxWidth;
		// map_click_pointGeom = new Extent({
		// 	"xmin" : map_click_point.x - padding, "ymin" : map_click_point.y - padding,
		// 	"xmax" : map_click_point.x + padding, "ymax" : map_click_point.y + padding,
		// 	"spatialReference" : map_click_point.spatialReference
		// });
		//
		// add_click_point_graphic(map_click_point);
		dojo.style(dom.byId("gridHUC12"), 'display', 'none');
		dom.byId("results").innerHTML = 'Searching HUC12s using HUC_CODE ' + huc_code;

		// use the 'map_click_pointGeom' for the initial query
		if (huc_code.length == 8)
		{
			app.qHUC12.where = huc8_field_nm + "  = '" + huc_code + "'";

		}
		else
		{
			app.qHUC12.where = huc12_field_nm + "  LIKE '" + huc_code + "%'";
		}
		// app.qHUC12.where = huc12_field_nm + "  = '" + huc_code + "'";

		app.qHUC8.where = huc8_field_nm + "  = '" + huc_code.substr(0, 8) + "'";

		exHUC12 = app.qtHUC12.execute(app.qHUC12);

		exHUC8  = app.qtHUC8.execute(app.qHUC8);

		// send these off for processing
		promises = all([ exHUC12 ]); // , exHUC8

		promises.then(handleQueryResults);



		console.log("++++ user entered huc_code. running initial HUC12 query ++++");
	}

	function executeQueries(e)
	{
		app.qHUC12.where = '';
		app.qHUC12.where = '';
		var exHUC12, exHUC8, promises;
		
		// to hide grid
		dojo.style(dom.byId("gridNavResults"), 'display', 'none');
		dojo.style(dom.byId("gridAttributeResults"), 'display', 'none');
		
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

		// if user has checked halt_click_navigation then don't continue here
		var field_nm = 'navigation_active';
		var inputFieldDom = document.getElementById(field_nm);
		if (inputFieldDom != null & inputFieldDom.checked == false){
			map_click_pointGeom = new Point({
				"x" : map_click_point.x,
				"y" : map_click_point.y,
				"spatialReference" : map_click_point.spatialReference
			});
			console.log("++++ ignoring user clicked map since navigation_active is checked. ++++ clicked : ", map_click_pointGeom.toJson());
			add_click_point_graphic_no_navigation(map_click_point)
			return;
		}

		add_click_point_graphic(map_click_point);

		NProgress.start();


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
		NProgress.done();
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
			// use a different symbol for the map clicked symbol
			feat.setSymbol(huc12_map_clicked_symbol());

			app.map.graphics.add(feat);
			
			if (! results_json.hasOwnProperty('huc12'))
			{
				results_json.huc12 = [];
			}
			
			// sensitive to name of HUC12 field
			huc_id = feat.attributes.HUC_12;
			
			results_json.huc12.push({
				'HUC12' : huc_id, 'HU_12_NAME' : feat.attributes[huc12_name_field_nm]
					// + ' ' + "<a href=zip>Upstream</a>"
					// + ' ' + "<a href=zip>Downstream</a>"
			});
			
			huc12_tx = feat.attributes.HUC_12 + ' ' + feat.attributes[huc12_name_field_nm]

			add_label(feat.geometry.getExtent().getCenter(), huc12_tx)
			
		});
		
		var click_again_tx = '';
		
		if (featHUC12.length == 1)
		{
			map_click_huc_code = huc_id;

			var huc_code_input = document.getElementById("navigation_huc_code");
			huc_code_input.value = map_click_huc_code;
			if (featHUC12.length == 1)
			{
				results_json.huc12.push([ 'NAVIGATING UPSTREAM\n<img src=/wbdmap/images/hourglass.gif />' ]);
				// map_click_huc_code =
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
			
			var a = document.getElementById("attribute");
			var attribute_name = a.options[a.selectedIndex].value;
			
			
			var navigation_direction = null;
			var noptions = document.getElementsByName("navigation_direction")
			for (i=0; i < noptions.length; i++)
			{
				if (noptions[i].checked == true)
				{
					navigation_direction = noptions[i].value;
				}
			}
			
			//window.alert(navigation_direction);
			// http://127.0.0.1:86/wbdtree/huc/110200050904/upstream/?format=json&attributes=headwater_bool&summary_data=false

			//TODO: figure out how to deal with attributes=headwater_bool

			var request = esriRequest({
			  url: navigator_url + '/' + huc_id + '/' + navigation_direction.toLowerCase() + '/?format=json&summary_data=true',


			  content: {
				'navigation_direction': navigation_direction,
				'attribute': attribute_name,
			    'code': huc_id
			  },
			  handleAs: "json"
			});
			NProgress.start();
			
			if (navigation_direction.toUpperCase() == 'UPSTREAM')
			{
				request.then(upstreamNavigationSucceeded, navigationFailed);
			}
			else
			{
				request.then(downstreamNavigationSucceeded, navigationFailed);
			}
		}
		else if (featHUC12.length > 1)
		{
			console.log("click again to select a single HUC12 to allow navigation");
			click_again_tx = '<div>Click on only one of the highlighted HUC-12 subwatersheds to navigate upstream.</div>';

			dojo.style(dom.byId("download_attributes"), 'display', 'none');

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
			hu12_headwater_list = [];

			var t1 = performance.now();
			console.log("++ wbd navigation finished in " + (t1 - t0).toFixed(3) + "ms");

			huc_json = results_json.huc12;
			huc_json.pop();

			if (data.navigation_data == null){
				alert("Error: There are no navigation results for the selected HU");
				return;
			}
			//data['huc8'] = data.huc12.value.substring(0, 8);
			if (data.navigation_data.results.hasOwnProperty('Error')){
				alert("Error: " + data.navigation_data.results.Error);
				return;
			}

			var hu12_list = data.navigation_data.results.hu12_data.hu12_list;
			huc12_ids_len = hu12_list.length;
			if (huc12_ids_len > 0)
			{
				//todo: check that it exists
				var huc_code_index_nu = data.navigation_data.results.hu12_data.fields.huc_code;

				//ibid
				var headwater_index_nu = data.navigation_data.results.hu12_data.fields.headwater_bool;

				// the rest service returns a list of the HUC12s called 'huc12_ids' (using NHD terminology)
				//var huc12_ids = data.huc12_ids;
				
				// huc12_ids_len = data.us_huc12_ids.value.length;
				
				// get a list of the HUC8s for HUC12s that were found - these will be shown on the map
				var huc8_ids = [];
				arrayUtils.forEach(hu12_list, function(hu12_tuple)
				{
					huc12_id = hu12_tuple[huc_code_index_nu];

					if (headwater_index_nu > -1
						&& hu12_tuple[headwater_index_nu] == true
						&& hu12_headwater_list.indexOf(huc12_id) === -1)
					{
						hu12_headwater_list.push(huc12_id)
					}

					var huc8_id = huc12_id.substring(0, 8);
					// don't add the HUC8 that contains the user clicked HUC12
					// if (huc8_id == data.hu_data.huc_code.substring(0, 8))
					// {
					// 	return;
					// }
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
				//TODO check it exists
				var huc_code_index_nu = data.navigation_data.results.hu12_data.fields.huc_code;

				if (dom.byId("show_all_huc12").checked)
				{
					//huc12_ids =	closest_slice(data.us_huc12_ids.value, 90, data.huc12.value);

					var i,j,temparray,chunk = 90;
					for (i=0,j=huc12_ids_len; i<j; i+=chunk)
					{
					    temparray = hu12_list.slice(i,i+chunk);


					    var hu12s = []
						arrayUtils.forEach(temparray, function(hu12_tuple) {
							var hc12_id = hu12_tuple[huc_code_index_nu];
							hu12s.push(hc12_id);
						});

					    // do whatever
						var query12 = new Query();
						query12.where = "HUC_12 in ('" + hu12s.join("','") + "')";
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
					huc12_ids = carefully_slice(hu12_list, 90, data.hu_data.huc_code);
					var hu12s = []
					arrayUtils.forEach(temparray, function(hu12_tuple) {
						var hc12_id = hu12_tuple[huc_code_index_nu];
						hu12s.push(hc12_id);
					});

					var query12 = new Query();
					query12.where = "HUC_12 in ('" + hu12s.join("','") + "')";
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
			//dojo.style(dom.byId("gridAttributeResults"), 'display', '');
			
			results_json.huc12 = huc_json;
			if (featHUC12.length == 1)
			{
				results_json.huc12.push('GETTING GIS RESULTS <img src=/wbdmap/images/hourglass.gif />');
			}
			str = 'JSON: ' + JSON.stringify(results_json, null, 4);

			dom.byId("results").innerHTML = '';
		}

		//
		// this is using 'data' - the results of the REST query - NOT ArcGIS
		//
		function downstreamNavigationSucceeded(data) 
		{
			//NProgress.done();
			huc_json = results_json.huc12;
			huc_json.pop();
			
			//data['huc8'] = data.huc12.value.substring(0, 8);
			var hu12_index_nu = data.navigation_data.results.hu12_data.fields.huc_code;
			var hu12_list = data.navigation_data.results.hu12_data.hu12_list;
			huc12_ids_len = hu12_list.length;
			if (huc12_ids_len > 0)
			{


				// get a list of the HUC8s for HUC12s that were found - these will be shown on the map
				var huc8_ids = [];
				arrayUtils.forEach(hu12_list, function(hu12_tuple)
				{
					var hu12_id = hu12_tuple[hu12_index_nu];

					var huc8_id = hu12_id.substring(0, 8);
					// don't add the HUC8 that contains the user clicked HUC12
					if (huc8_id == data.hu_data.huc_code.substring(0, 8))
					{
						return;
					}
					if (huc8_ids.indexOf(huc8_id) === -1)
					{ 
						huc8_ids.push(huc8_id)
					}
				});
				// data['downstream_huc8_count_nu']['value'] = huc8_ids.length;
				
				// now send off the HUC12 query again, this time with a list of all HUC8s just created
				// there is a limit of how many huc12_ids can be included.  it might be line length of the query
				// it seems that the magic number is 90
				var huc12_ids = []
				var deferred_queries = [ ];
				

					//huc12_ids =	closest_slice(data.us_huc12_ids.value, 90, data.huc12.value);
					
				var i,j,temparray,chunk = 90;
				for (i=0,j=huc12_ids_len; i<j; i+=chunk)
				{
				    temparray = hu12_list.slice(i,i+chunk);

					var hu12s = []
					arrayUtils.forEach(temparray, function(hu12_tuple) {
						hu12s.push(hu12_tuple[hu12_index_nu]);
					});

					var query12 = new Query();
					query12.where = "HUC_12 in ('" + hu12s.join("','") + "')";

					query12.returnGeometry = true;
					query12.outFields  = [ "*" ];
					
					app.qtHUC12 = new QueryTask(huc12_mapserver);
					var exHUC12 = app.qtHUC12.execute(query12);
					
					deferred_queries.push(exHUC12);					    
				}
					
				


				//TODO maybe we dont need the hu8s on downstream
				if (huc8_ids.length > 0) //  & ! dom.byId("termsCheck").checked)
				{
					// var query8 = new Query();
					// query8.where = "HUC_8 in ('" + huc8_ids.join("','") + "')";
					// query8.returnGeometry = true;
					// query8.outFields  = [ "*" ];
					//
					// app.qtHUC8 = new QueryTask(huc8_mapserver);
					// exHUC8 = app.qtHUC8.execute(query8);
					//
					// deferred_queries.push(exHUC8);
				}
				promises = all(deferred_queries);
				
				promises.then(handleUpstreamNavigationQueryResults);
				

				console.log("running " + deferred_queries.length + " HUC12 Downstream GIS queries");
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
				
				console.log("running single HUC12 Downstream queries");
			}
			huc_json.push({'NAVIGATION_RESULTS': data });
			
			tableNavigationResults(data);
			// show grid
			dojo.style(dom.byId("gridNavResults"), 'display', '');
			//dojo.style(dom.byId("gridAttributeResults"), 'display', '');
			
			results_json.huc12 = huc_json;
			if (featHUC12.length == 1)
			{
				results_json.huc12.push('GETTING GIS RESULTS <img src=/wbdmap/images/hourglass.gif />');
			}
			str = 'JSON: ' + JSON.stringify(results_json, null, 4);

			dom.byId("results").innerHTML = '';
		}

		
		function navigationFailed(error) {
			hideLoading();
			console.log("HUC12 Navigation Failed: ", error.message);
			results_json['HUC12_Navigation'] = {'NAVIGATION_FAILED': error.message};
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

					var huc_code = myHUC12s.features[i]['attributes'][huc12_field_nm];

					if (hu12_headwater_list.includes(huc_code)){
						sym = huc12_headwater_symbol();
					}
					if (huc_code == map_click_huc_code){
						sym = huc12_map_clicked_symbol();
					}

					myHUC12s.features[i].setSymbol(sym);
							
					app.map.graphics.add(myHUC12s.features[i]);
						
				}
			}			


		});
		console.log("added " + huc12_feature_count + " HUC12 features to map");
		NProgress.done();
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
			
			if (values.hasOwnProperty('HUC12'))
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

	function navAttributeLabel(label_tx) {
		switch (label_tx){
			case 'headwater_bool':
				return "Is Headwater?";
			case 'terminal_bool':
				return "Is Terminal?";
			case 'hu12_count_nu':
				return "HU12 Count";
			case 'headwater_bool':
				return "Goon";
			case 'area_sq_km':
				return "Area (km2)";
			case 'water_area_sq_km':
				return "Water Area (km2)";
			default:
				return label_tx;
		}
	}

	function tableNavigationResults(data)
	{
		/*

		TODO: change this to a list, and show the title text.  Also include links to download metatadata
		i.e.
		* US EPA Metrics 2016 Download (metadata)


		 */
		if (data.navigation_data.hasOwnProperty('download')){
			//TODO: use the data structures for this, don't hardwire it
			var download_list = [
				['api_downstream', 'API Downstream', data.hu_data.resources.downstream.url, data.hu_data.resources.downstream.title],
				['api_upstream', 'API Upstream', data.hu_data.resources.upstream.url, data.hu_data.resources.upstream.title],
				//TODO: 'download' should also be called 'resources' - they are downloadable resources
				['download_attributes', 'Navigation', data.navigation_data.download.download.url, data.navigation_data.download.download.title],
				['download_metrics2016', 'Metrics 2016', data.navigation_data.download.metrics2016.url, data.navigation_data.download.metrics2016.title],
				['download_metrics2017', 'Metrics 2017', data.navigation_data.download.metrics2017.url, data.navigation_data.download.metrics2017.title],
				['download_geography', 'Geography', data.navigation_data.download.geography.url, data.navigation_data.download.geography.title],
			]
			download_list.forEach(function(item) {
				var id = item[0];
				var label = item[1];
				var url = item[2];
				var title = (item.length == 4) ? item[3] : '';
				var domBit = dom.byId(id);
				var tx = '<a href="' + url + '" target="_api" class="btn btn-info" role="button" title="' + title + '">' + label + '</a>';
				//TODO change into a list with Label and 2 buttons - 1 for data, and 1 for metadata
				//tx = '<li>' + label + '<a href="' + url + '" target="_api" class="btn btn-info" role="button">Download</a><a href="' + url + '" target="_api" class="btn btn-info" role="button">Metadata</a></li><br>';
				domBit.innerHTML = tx;
				dojo.style(domBit, 'display', 'inline-block');
			})
		}
		else
		{
			dojo.style(dom.byId("api_downstream"), 'display', 'none');
			dojo.style(dom.byId("api_upstream"), 'display', 'none');
			dojo.style(dom.byId("download_attributes"), 'display', 'none');
			dojo.style(dom.byId("download_metrics2016"), 'display', 'none');
			dojo.style(dom.byId("download_metrics2017"), 'display', 'none');
			dojo.style(dom.byId("download_geography"), 'display', 'none');
		}


		// things are formatted in the REST service - but this is setting the contents and order
		attribute_list = [
						'hu12_count_nu',
			'headwater_count_nu',
			'area_sq_km',
			'water_area_sq_km',
			'distance_km',




			 'headwater_bool',
			 'terminal_bool',
			 'ds_area_sq_km',
			 'us_water_area_sq_km', 
			 'ds_water_area_sq_km', 
			 'huc8', 
			 'upstream_huc8_count_nu',
			 'downstream_huc8_count_nu'
			];

		// there are attributes in data.hu_data
		//  and data.navigation_data.results.summary_data
		var results_data = [];
		attribute_list.forEach(function(key) {
			if (data.navigation_data.results.summary_data.hasOwnProperty(key))
			{
				result_data = data.navigation_data.results.summary_data[key];

				result_with_commas = numberWithCommas(result_data);
				// value_display = result_data['value'];
				//
				// if (result_data.hasOwnProperty('units'))
				// {
				// 	value_display = value_display + ' ' + result_data['units']
				// }

				results_data.push({'key': navAttributeLabel(key), 'value': result_with_commas});
			}
			else if (data.hu_data.hasOwnProperty(key))
			{
				result_data = data.hu_data[key];
				result_with_commas = numberWithCommas(result_data);

				var key_display = key;
				if (key == 'headwater_bool')
				{
					key_display = "Is Headwater?";
				}
				else if (key == 'terminal_bool')
				{
					key_display = "Is Terminal?";
				}
				// value_display = result_data['value'];
				//
				// if (result_data.hasOwnProperty('units'))
				// {
				// 	value_display = value_display + ' ' + result_data['units']
				// }
				results_data.push({'key': key_display, 'value': result_with_commas});
			}
		});
		if (data.hu_data.hasOwnProperty('terminal_hu12_ds')
			&& data.hu_data.terminal_hu12_ds !== null)
		{
			results_data.push({'key': 'terminal_huc12_ds', 'value': data.hu_data.terminal_hu12_ds.huc_code});
			results_data.push({'key': 'terminal_huc12_ds_name', 'value': data.hu_data.terminal_hu12_ds.name});
			results_data.push({'key': 'terminal_hu12_ds_count_nu', 'value': data.hu_data.terminal_hu12_ds.hu12_ds_count_nu});
			results_data.push({'key': 'outlet_type', 'value': data.hu_data.terminal_hu12_ds.outlet_type});
			results_data.push({'key': 'outlet_type_code', 'value': data.hu_data.terminal_hu12_ds.outlet_type_code});
		}
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
        
		// things are formatted in the REST service - but this is setting the contents and order
        if (data.hasOwnProperty('attribute_results'))
        {
			attribute_list = [
				 'name', 
				 'root_value', 
				 'us_value', 
				];
			
			results_data2 = [];
			results_data2.push({'key': 'Name', 'value': data.attribute_results['name']});
			results_data2.push({'key': 'HUC Value', 'value': data.attribute_results['root_value'] + ' ' + data.attribute_results['units']});
			if (data.attribute_results['us_count_nu'] > 0)
			{
				results_data2.push({'key': 'Upstream HUC Value', 'value': data.attribute_results['us_value'] + ' ' + data.attribute_results['units']});
			}
				// create an object store
	        var objectStore2 = new Memory({
	            data: results_data2
	        });
	        results2Store2 = new dojo.data.ObjectStore({objectStore: objectStore2});
	        gridAttributeResults.store = results2Store2;
	        
			// show grid
	        gridAttributeResults.render();
			dojo.style(dom.byId("gridAttributeResults"), 'display', '');
	        dijit.byId('gridAttributeResults').resize();
        }
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

//function closest_slice(ids, max_count_nu, target_huc_id)
//{
//	if (ids.length <= max_count_nu)
//	{
//		return ids;
//	}
//
//	var returned_ids = [];
//	
//	// this loop gets the hucs that most look like the 'target' huc (the one the user clicked)
//	// it is superceded by the one above it
//	for (i = 0; i < target_huc_id.length; i++)
//	{
//		for (var idx in ids)
//		{
//			id = ids[idx];
//		
//			if (id.slice(0, 12 - i) == target_huc_id.slice(0, 12 - i))
//			{
//				console.log('matched id==' + id.slice(0, 12 - i) + ' for target_huc_id==' + target_huc_id);
//			
//				// fix this issue here # buggy_huc12 101600102004  the bug is in the HUC coverage, not the routing tables.
//				if (id == 101600112004)
//				{
//					id = 101600102004;
//				}
//				returned_ids.push(id);
//				if (returned_ids.length == max_count_nu)
//				{
//					break;
//				}
//			}
//		}
//		if (returned_ids.length == max_count_nu)
//		{
//			break;
//		}
//	}
//	return (returned_ids);
//};

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

function add_click_point_graphic_no_navigation(point)
{
	// add a simple marker graphic at the location where the user clicked on the map.
	var pointSymbol = new esri.symbol.SimpleMarkerSymbol(
			esri.symbol.SimpleMarkerSymbol.STYLE_CROSS, 22,
							new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID,
							new dojo.Color([ 128, 0, 0 ]), 4)
							);
	var clickPointGraphic = new esri.Graphic(point, pointSymbol);
	app.map.graphics.add(clickPointGraphic);
};

function numberWithCommas(x) {
    var parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
}

function huc12_map_clicked_symbol()
{
	var sfs = new esri.symbol.SimpleFillSymbol({
		  "type": "esriSFS",
		  "style": "esriSFSSolid",
		  "color": [244, 167, 66, 100]
		});
	var sls = new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_DASHDOT, new dojo.Color([0,0,0, 50]), 1);

	sfs.setOutline(sls);

	return sfs;
}

function huc12_symbol()
{
	var sfs = new esri.symbol.SimpleFillSymbol({
		  "type": "esriSFS",
		  "style": "esriSFSSolid",
		  "color": [0,255,0,40]
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

function huc12_terminal_symbol()
{
	var sfs = new esri.symbol.SimpleFillSymbol({
		  "type": "esriSFS",
		  "style": "esriSFSSolid",
		  "color": "blue" //TODO [105, 170, 170, 100]
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
		  "color": [0,0, 0,0]
		});
	var sls = new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([0,0,0, 50]), 2);
	
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