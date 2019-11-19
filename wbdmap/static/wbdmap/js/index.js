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
	"esri/SpatialReference",
	"esri/tasks/query",
	"esri/tasks/QueryTask",
	"esri/tasks/GeometryService",
	"esri/tasks/ProjectParameters",
	"esri/request",
	"dijit/layout/BorderContainer",
	"dijit/layout/TabContainer",
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
	SpatialReference,
	Query, 
	QueryTask,
	GeometryService,
	ProjectParameters,
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
	// esriConfig.defaults.io.httpsDomains.push("cida.usgs.gov"); //nhd
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
	var outSR = 102100; // "YOUR_OUTPUT_COORDINATE_SYSTEM"; // `wkid {number}`
	var geometryService = new GeometryService("https://utility.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer");

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

	var NAVIGATOR_ACTIVE = true;

	//NHD stuff
	var nldiURL = "/nldi/"; // + HUC12 + "/navigate/UT?distance="

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
	        {name:"Indicator", field:"key", width: "150px"},
	        {name:"Value", field:"value", width: "278px"},
	        ]
		}, "gridAttributeResults");
		gridAttributeResults.startup();
	    dijit.byId('gridAttributeResults').resize();
	    dojo.style(dom.byId("gridAttributeResults"), 'display', 'none');
	}
	
	// make the EnviroAtlas HUC12 Navigator widget movable

	//jab - disabled because it disables input to the widget.
	//TODO there is a way to do this - somehow you make the 'title' bar the movable part
	// and it drags the rest of the widget
	// var widBox = dom.byId("widgetOuter");
	// if (widBox != null)
	//  {
	// 	var dnd = new Moveable(widBox, 5, false);
	//  }

	//the way to do this is to use dojox.layout.FloatingPane

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


	  // on(dom.byId("controls"), "click", function(){
		// var dnd = new Moveable(dom.byId("dndOne"));
	  // });

	dojo.query("#navigation_active").on('change', function() {
		NAVIGATOR_ACTIVE = this.checked;
	});

	dojo.query('#navDirection').on('change', function() {
		var noptions = document.getElementsByName("navigation_direction");
		var direction = '';
		for (i=0; i < noptions.length; i++)
		{
			if (noptions[i].checked == true)
			{
				direction = noptions[i].value;
				break
			}
		}

		var existingMessageText = dom.byId("NavigationMessages").innerHTML;

		var messageText = 'Click the map to navigation '
			+ direction.toLowerCase() + ' on the<br>Watershed Boundary Dataset Subwatersheds (HUC-12)';

		var messageText2 =	'Click on only one of the highlighted HUC-12 subwatersheds to navigate '
			+ direction.toLowerCase() + '.';

		var messageToUse = messageText;
		if(existingMessageText.indexOf('highlighted') !== -1)
		{
			messageToUse = messageText2;
		}

		dom.byId("NavigationMessages").innerHTML = messageToUse;

		//navigation_huc_code
		//dojo.query("#navigation_huc_code").focus();
		var huc_code_input = document.getElementById("navigation_huc_code");
		if (huc_code_input.value.length == 12){
			//TODO: use a dijit Dialog for this question rather than javascript built-in
			var r = confirm("Do you want to navigate " + direction.toLowerCase() + " from subwatershed " + huc_code_input.value + "'?");
			if (r == true){
				executeHUCSearch(huc_code_input.value)
			}
		}

	});

	//TODO: make this useful.  needs to change text as context changes
	var tip = 'Click to select<br>a subwatershed';
    var tooltip = dojo.create("div", { "class": "tooltip22", "innerHTML": tip }, app.map.container);
    dojo.style(tooltip, {"position": "fixed",
		"font-size": "10px",
		'background': 'white',
		'border': 'solid',
		'border-radius': '5px',
		'border-width': 'thin',
		'border-color': 'paleblue',
		'padding': '2px'});
    var px = 200;
    var py = 200;
	dojo.style(tooltip, { left: (px + 15) + "px", top: (py) + "px" });
	tooltip.style.display = "none";

	app.map.on('mouse-move', showToolTip);

	app.map.on('mouse-out', hideToolTip);

	function hideToolTip(evt) {
		tooltip.style.display = "none";
	}

	function showToolTip(evt) {
		if (NAVIGATOR_ACTIVE == false){
			tooltip.style.display = "none";
			return;
		}
		var px, py;
		if (evt.clientX || evt.pageY) {
		  px = evt.clientX;
		  py = evt.clientY;
		} else {
		  px = evt.clientX + dojo.body().scrollLeft - dojo.body().clientLeft;
		  py = evt.clientY + dojo.body().scrollTop - dojo.body().clientTop;
		}
		tooltip.style.display = "none";
		dojo.style(tooltip, { left: (px + 15) + "px", top: (py) + "px", display: "" });
		// dojo.style(tooltip, "display", "");
		// tooltip.style.display = "";
	}

	app.map.on("click", executeQueries);



	// dojo.query("#navigation_huc_code").onmousedown(function (e) {
	// 	dojo.query("#navigation_huc_code").focus();
	// });

	dojo.query("#navigation_huc_code").onkeyup(huc_code_Search);
	// $("#navigation_huc_code").on("change", huc_code_Search);

	function getUrlParameter(name) {
		name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
		var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
		var results = regex.exec(location.search);
		return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
	};

	// check if the URL query string has a 'direction' parameter
	var navigation_direction = getUrlParameter('direction');

	if (navigation_direction !== null
		&& (navigation_direction == 'upstream' || navigation_direction == 'downstream'))
	{
		var noptions = document.getElementsByName("navigation_direction")
		for (i=0; i < noptions.length; i++)
		{
			if (noptions[i].value.toUpperCase() == navigation_direction.toUpperCase())
			{
				noptions[i].checked = true;
			}
			else
			{
				noptions[i].checked = false;
			}
		}
	}


	function showFeatureToolTip(evt) {
		return; //TODO
		if (NAVIGATOR_ACTIVE == false){
			tooltip.style.display = "none";
			return;
		}
		tooltip.innerHTML = "wow!";
		var px, py;
		if (evt.clientX || evt.pageY) {
		  px = evt.clientX;
		  py = evt.clientY;
		} else {
		  px = evt.clientX + dojo.body().scrollLeft - dojo.body().clientLeft;
		  py = evt.clientY + dojo.body().scrollTop - dojo.body().clientTop;
		}
		tooltip.style.display = "none";
		dojo.style(tooltip, { left: (px + 15) + "px", top: (py) + "px", display: "" });
	}
	function hideFeatureToolTip(evt) {
		return; //TODO
		tooltip.innerHTML = 'Click to select<br>a subwatershed';

	}
	// check if the URL query string has a 'hu' parameter //TODO: confirm name of this query string variable
	var huc_code = getUrlParameter('hu');

	if (huc_code !== null){
		var reg = new RegExp('^\\d{12}');
		if (reg.test(huc_code))
		{
			executeHUCSearch(huc_code);
		}

	}

	function huc_code_Search(evnt){
		var huc_code = evnt.target.value;
		var navigateButton = document.getElementById('navigateViaText');
		if (huc_code.length == 12 || huc_code.length == 8){
			navigateButton.disabled = false;
		}
		else {
			navigateButton.disabled = true;
		}
	}

	dojo.query('#navigateViaText').on('click', function() {
		var huc_code = document.getElementById('navigation_huc_code');
		executeHUCSearch(huc_code.value);
	});

	initHUC12Grid();
	initNavigationGrid();
	initAttributeGrid();
	NProgress.configure({ parent: '#thin_blue_line' });
	dom.byId("NavigationMessages").innerHTML = 'Click the map to navigation upstream on the<br>Watershed Boundary Dataset Subwatersheds (HUC-12)';

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
		dom.byId("NavigationMessages").innerHTML = 'Searching HUC12s using HUC_CODE ' + huc_code;

		// use the 'map_click_pointGeom' for the initial query
		if (huc_code.length == 8)
		{
			app.qHUC12.where = huc8_field_nm + "  = '" + huc_code + "'";

		}
		else
		{
			app.qHUC12.where = huc12_field_nm + "  LIKE '" + huc_code + "%'";
		}
		//app.qHUC12.where = huc12_field_nm + "  = '" + huc_code + "'";

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
		if (NAVIGATOR_ACTIVE == false){
			return;
		}

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

		add_click_point_graphic(map_click_point);

		NProgress.start();


		dojo.style(dom.byId("gridHUC12"), 'display', 'none');
		dom.byId("NavigationMessages").innerHTML = 'Searching HUC12s using mouse click ...';
		
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
		dom.byId("NavigationMessages").innerHTML = 'Processing Results ...';
		
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
			app.map.graphics.on('mouse-move', showFeatureToolTip);
			app.map.graphics.on('mouse-out', hideFeatureToolTip);
			if (! results_json.hasOwnProperty('huc12'))
			{
				results_json.huc12 = [];
			}
			
			// sensitive to name of HUC12 field
			huc_id = feat.attributes.HUC_12;
			
			results_json.huc12.push({
				'HUC12' : huc_id, 'HU_12_NAME' : feat.attributes[huc12_name_field_nm]
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

			// var permalink_anchor = document.getElementById("permalink_anchor");
			// permalink_anchor.href = navigator_url + "/map/?direction=upstream&hu=" + map_click_huc_code;


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
			//2019-08-26 starting
			var attribute_select = document.getElementById('attribute');
			// this is the field_nm recognized by wbdattributes
			var field_nm = a.options[a.selectedIndex].value;

			var content = {
				'navigation_direction': navigation_direction,
				'attribute': attribute_name,
			    'code': huc_id
			  };
			if (field_nm != 'NONE')
			{
				content['attribute_field_nm'] = field_nm;
			}

			var request = esriRequest({
			  url: navigator_url + '/huc/' + huc_id + '/' + navigation_direction.toLowerCase() + '/?format=json&summary_data=true',

			  content: content,
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


			// var requestNHDLines = esriRequest({
			//   url: nldiURL + huc_id ,
			//
			//   handleAs: "json"
			// });
			// NProgress.start();
			//
			// if (navigation_direction.toUpperCase() == 'UPSTREAM')
			// {
			// 	requestNHDLines.then(upstreamNHDNavigationSucceeded, navigationFailed);
			// }
			// else
			// {
			// 	requestNHDLines.then(downstreamNHDNavigationSucceeded, navigationFailed);
			// }
		}
		else if (featHUC12.length > 1)
		{
			console.log("click again to select a single HUC12 to allow navigation");
			var noptions = document.getElementsByName("navigation_direction");
			var direction = '';
			for (i=0; i < noptions.length; i++)
			{
				if (noptions[i].checked == true)
				{
					direction = noptions[i].value;
					break
				}
			}
			click_again_tx = '<div>Click on only one of the highlighted HUC-12 subwatersheds to navigate '
			+ direction + '.</div>';

			dojo.style(dom.byId("download_attributes"), 'display', 'none');

		}
		else
		{
			click_again_tx = '<div style="color: red";>Click somewhere within the US boundary to find a Subwatershed (HUC-12) to navigate/</div>';
		}

		dom.byId("NavigationMessages").innerHTML = click_again_tx;
		dom.byId("NavigateErrorMessage").innerHTML = click_again_tx;
		
		tableResults(results_json);
		dojo.style(dom.byId("gridHUC12"), 'display', '');

		// this is handling NHD flowline
		function upstreamNHDNavigationSucceeded(Qresults)
		{
			var t1 = performance.now();
			console.log("++ nhd gis queries finished in " + (t1 - t0).toFixed(3) + "ms");
			//console.log("exHUC12 queries finished: ", Qresults);

			// huc_json = results_json.huc12;
			// huc_json.pop();
			//
			// //sorry
			// //var huc12_headwaters = results_json['huc12'][1]["NAVIGATION_RESULTS"]["navigation_data"]["results"]["upstream_hu12_headwaters_list"];
			//
			// var terminal_hu12 = results_json['huc12'][1]['NAVIGATION_RESULTS']['hu_data']['terminal_hu12_ds']['huc_code'];

			// str = 'JSON: ' + JSON.stringify(results_json, null, 4);
			// dom.byId("NavigationMessages").innerHTML = ""; // "<pre>" + str + '</pre>'; //  + tableResults(results_json.huc12);
			// dom.byId("NavigateErrorMessage").innerHTML = '';
			if (!Qresults.hasOwnProperty("features"))
			{
				console.log("nldi query failed.");
			}

			if (Qresults.features.length >= 1)
			{
				var projectParams = new ProjectParameters();


				var features = Qresults.features;

				// app.map.setExtent(graphicsUtils.graphicsExtent(features));

				arrayUtils.forEach(features, function(feat)
				{
					//huc8_tx = feat.attributes.HUC_8 + ' ' + feat.attributes.HU_8_NAME;
					//add_huc8_label(feat.geometry.getExtent().getCenter(), huc8_tx);

					// feat.setSymbol(huc8_symbol());

					var simpleLineSymbol = {
					 type: "simple-line",
					 color: [226, 119, 40], // orange
					 width: 2
				   };

    				projectParams.geometries = [feat.geometry];
    				projectParams.outSR = new SpatialReference({ wkid: outSR });
					var projected_coords;
					geometryService.project(projectParams, (result) => {
					  projected_coords = result; // outputpoint first element of result array

					});

				   var polyline = {
					 type: "polyline",
					 paths: projected_coords
				   };

				   var polylineGraphic = new Graphic({
					 geometry: polyline,
					 symbol: simpleLineSymbol
				   })

				   // graphicsLayer.add(polylineGraphic);

					app.map.graphics.add(polylineGraphic);
				});
				console.log("added " + features.length + " NHD line-features to map");
			}
			// else if (Qresults.length == 1)
			// {
			// 	featHUC12 = Qresults[0].features;
			//
			// 	if (featHUC12.length > 0){
			// 		app.map.setExtent(graphicsUtils.graphicsExtent(featHUC12));
			// 	}
			//
			// }

			//featHUC12 = results[0].features;
			// var huc12_feature_count = 0;
			// arrayUtils.forEach(Qresults, function(featHUC12)
			// {
			// 	// this changed at some time 2019-04-26
			// 	// if (featHUC12.hasOwnProperty('displayFieldName') & featHUC12['displayFieldName'] == "HU_12_NAME")
			// 	if (featHUC12.features.length > 0
			// 			&& featHUC12.features[0].attributes.hasOwnProperty([huc12_name_field_nm])) /* diff on waters and enviro */
			// 	{
			// 		//console.log('in HU_12_NAME');
			// 		var myHUC12s = featHUC12;
			// 		for (i=0; i < myHUC12s.features.length; i += 1)
			// 		{
			// 			huc12_feature_count += 1;
			//
			// 			var sym = huc12_symbol();
			//
			// 			var huc_code = myHUC12s.features[i]['attributes'][huc12_field_nm];
			//
			// 			if (hu12_headwater_list.includes(huc_code)){
			// 				sym = huc12_headwater_symbol();
			// 			}
			// 			else if (huc_code == terminal_hu12){
			// 				sym = huc12_terminal_symbol();
			// 			}
			// 			if (huc_code == map_click_huc_code){
			// 				sym = huc12_map_clicked_symbol();
			// 			}
			//
			// 			myHUC12s.features[i].setSymbol(sym);
			//
			// 			app.map.graphics.add(myHUC12s.features[i]);
			//
			// 		}
			// 	}
			//
			//
			// });
			// console.log("added " + huc12_feature_count + " HUC12 features to map");
			NProgress.done();
			hideLoading();

			// put the users click point back on the map
			// add_click_point_graphic(map_click_point);
		}

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
				tableNavigationResults(data);

				// if this is a terminal huc or a headwater huc, change the symbol
				//TODO: figure out how to make sure I'm changing the right graphic
				// - should use an ID of some kind
				if (data.hu_data.headwater_bool == true){
					app.map.graphics.graphics[1].symbol = huc12_headwater_symbol();
					app.map.graphics.refresh();
				}
				else if (data.hu_data.terminal_bool == true){
					app.map.graphics.graphics[1].symbol = huc12_terminal_symbol();
					app.map.graphics.refresh();
				}



				// show grid
				dojo.style(dom.byId("gridNavResults"), 'display', '');
				NProgress.done();
				hideLoading();
				// alert("Error: There are no navigation results for the selected HU");
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

			dom.byId("NavigationMessages").innerHTML = '';
			dom.byId("NavigateErrorMessage").innerHTML = '';
		}

		//
		// this is using 'data' - the results of the REST query - NOT ArcGIS
		//
		function downstreamNavigationSucceeded(data) 
		{
			//NProgress.done();
			huc_json = results_json.huc12;
			huc_json.pop();

			var hu12_index_nu = '';
			var hu12_list = [];


			if (data.navigation_data !== null)
			{
				var hu12_index_nu = data.navigation_data.results.hu12_data.fields.huc_code;
				var hu12_list = data.navigation_data.results.hu12_data.hu12_list;
			}

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
				if (data.hu_data.terminal_bool == true){
					app.map.graphics.graphics[1].symbol = huc12_terminal_symbol();
					app.map.graphics.refresh();
				}
			}
			str = 'JSON: ' + JSON.stringify(results_json, null, 4);

			dom.byId("NavigationMessages").innerHTML = '';
			dom.byId("NavigateErrorMessage").innerHTML = '';
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
		//var huc12_headwaters = results_json['huc12'][1]["NAVIGATION_RESULTS"]["navigation_data"]["results"]["upstream_hu12_headwaters_list"];

		var terminal_hu12 = results_json['huc12'][1]['NAVIGATION_RESULTS']['hu_data']['terminal_hu12_ds']['huc_code'];

		str = 'JSON: ' + JSON.stringify(results_json, null, 4);
		dom.byId("NavigationMessages").innerHTML = ""; // "<pre>" + str + '</pre>'; //  + tableResults(results_json.huc12);
		dom.byId("NavigateErrorMessage").innerHTML = '';
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
					else if (huc_code == terminal_hu12){
						sym = huc12_terminal_symbol();
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
				return "HU12 Upstream Count";
			case 'headwater_bool':
				return "Is Headwater?";
			case 'area_sq_km':
				return "Area (km2)";
			case 'water_area_sq_km':
				return "Water Area (km2)";
			case 'distance_km':
				return "Upstream Stream Length (km)";
			case 'headwater_count_nu':
				return  "HU12 Headwater Count";
			case 'terminal_huc12_ds':
				return "Terminal HU12";
			case 'terminal_huc12_ds_name':
				return "Terminal HU12 Name";
			case 'terminal_hu12_ds_count_nu':
				return  "HU12 Downstream Count";
			case 'outlet_type':
				return  "Terminal HU12 Type";
			case 'outlet_type_code':
				return  "Terminal HU12 Type Code";
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
		if (data.hasOwnProperty('navigation_data')
			&& data.navigation_data !== null
			&& data.navigation_data.hasOwnProperty('download')){
			//TODO: use the data structures for this, don't hardwire it
			var download_list = [
				['download_metrics2016', 'Metrics 2016', data.navigation_data.download.metrics2016.url, data.navigation_data.download.metrics2016.title],
				['download_metrics2017', 'Metrics 2017', data.navigation_data.download.metrics2017.url, data.navigation_data.download.metrics2017.title],
				['download_geography', 'Geography', data.navigation_data.download.geography.url, data.navigation_data.download.geography.title],
				['download_attributes', 'Navigation', data.navigation_data.download.download.url, data.navigation_data.download.download.title],
				['permalink', 'Permalink', data.navigation_data.download.permalink.url, data.navigation_data.download.permalink.title],

				['api_downstream', 'API Downstream', data.hu_data.resources.downstream.url, data.hu_data.resources.downstream.title],
				['api_upstream', 'API Upstream', data.hu_data.resources.upstream.url, data.hu_data.resources.upstream.title],
				//TODO: 'download' should also be called 'resources' - they are downloadable resources
			]
			download_list.forEach(function(item) {
				var function_tx = 'target="_api"';
				var id = item[0];
				var metadata_button_label = 'Metadata';
				var metadata_url = '/metadata/' + id;
				if (id == 'permalink'){
					metadata_button_label = "-- Copy --";
					function_tx = 'onclick="return copyToClipboard(\'' + data.navigation_data.download.permalink.url + '\')"';
				}
				var label = item[1];
				label = "Download";
				if (id == 'permalink') label = "-- Open --";
				var url = item[2];


				var title = (item.length == 4) ? item[3] : '';

				var target = (id.indexOf('api_') > -1) ? 'target="_api"': '';

				var domBit = dom.byId(id);

				var tx = "<div style='float: left;'>" + title + '</div>' +
					"<div style='float: right'>" +

					'<a href="' + metadata_url + '" ' + function_tx + ' class="btn btn-info" role="button" title=" metadata ' + title + '">' + metadata_button_label + '</a>' +
					'<a href="' + url + '" ' + target + ' class="btn btn-info" style="margin-left: 3px;" role="button" title="' + title + '">' + label + '</a>' +
					'</div></div>';
				//TODO change into a list with Label and 2 buttons - 1 for data, and 1 for metadata
				//tx = '<li>' + label + '<a href="' + url + '" target="_api" class="btn btn-info" role="button">Download</a><a href="' + url + '" target="_api" class="btn btn-info" role="button">Metadata</a></li><br>';
				domBit.innerHTML = tx;
				dojo.style(domBit, 'display', 'inline');
				dojo.style(domBit, 'line-height', '24px');
			})
		}
		else
		{
			dojo.style(dom.byId("api_downstream"), 'display', 'none');
			dojo.style(dom.byId("api_upstream"), 'display', 'none');
			dojo.style(dom.byId("permalink"), 'display', 'none');
			dojo.style(dom.byId("download_attributes"), 'display', 'none');
			dojo.style(dom.byId("download_metrics2016"), 'display', 'none');
			dojo.style(dom.byId("download_metrics2017"), 'display', 'none');
			dojo.style(dom.byId("download_geography"), 'display', 'none');
		}


		// things are formatted in the REST service - but this is setting the contents and order
		upstream_only_list = [
			'hu12_count_nu',
			'headwater_count_nu',
			'area_sq_km',
			'water_area_sq_km',
			'distance_km'
		];

		attribute_list = [
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
		var direction = 'upstream';
		if (data.hasOwnProperty('navigation_data')
			&& data.navigation_data !== null
			&& data.navigation_data.hasOwnProperty('direction'))
		{
			direction = data.navigation_data.direction;
		}


		if (direction == 'upstream'){
			upstream_only_list.forEach(function(key) {
				result_data = '';
				if (data.hasOwnProperty('navigation_data')
					&& data.navigation_data !== null
					&& data.navigation_data.results.summary_data.hasOwnProperty(key))
				{
					result_data = data.navigation_data.results.summary_data[key];
				}
				else if (data.hu_data.hasOwnProperty(key))
				{
					result_data = data.hu_data[key];

				}
				if (result_data.toString().length > 0){
					result_with_commas = numberWithCommas(result_data);

					results_data.push({'key': navAttributeLabel(key), 'value': result_with_commas});
				}
			});
		}

		attribute_list.forEach(function(key) {
			result_data = '';
			if (data.hasOwnProperty('navigation_data')
				&& data.navigation_data !== null
				&& data.navigation_data.results.summary_data.hasOwnProperty(key))
			{
				result_data = data.navigation_data.results.summary_data[key];

			}
			else if (data.hu_data.hasOwnProperty(key))
			{
				result_data = data.hu_data[key];
					if (result_data === true)
					{
						result_data = 'Yes'
					}
					else if (result_data === false)
					{
						result_data = 'No'
					}
			}
			if (result_data.toString().length > 0){
				result_with_commas = numberWithCommas(result_data);

				results_data.push({'key': navAttributeLabel(key), 'value': result_with_commas});
			}

		});

		if (data.hu_data.hasOwnProperty('terminal_hu12_ds')
			&& data.hu_data.terminal_hu12_ds !== null)
		{
			results_data.push({'key': navAttributeLabel('terminal_huc12_ds'), 'value': data.hu_data.terminal_hu12_ds.huc_code});
			results_data.push({'key': navAttributeLabel('terminal_huc12_ds_name'), 'value': data.hu_data.terminal_hu12_ds.name});
			results_data.push({'key': navAttributeLabel('terminal_hu12_ds_count_nu'), 'value': data.hu_data.terminal_hu12_ds.hu12_ds_count_nu});
			results_data.push({'key': navAttributeLabel('outlet_type'), 'value': data.hu_data.terminal_hu12_ds.outlet_type});
			results_data.push({'key': navAttributeLabel('outlet_type_code'), 'value': data.hu_data.terminal_hu12_ds.outlet_type_code});
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
		// NOT CURRENTLY WORKING
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
		if (data.navigation_data !== null
			&& data.hasOwnProperty('attributes')
			&& data['attributes'].hasOwnProperty(('sanitized')))
        {
        	var field_nm = data['attributes']['attributes_tx'];
        	var field_meta = data['attributes']['sanitized']['valid_attributes'][field_nm];

        	//TODO: figure out data handling better
        	var result_va = data['navigation_data']['results']['aggregated_attribute']['result_va'];

			result_tx = numberWithCommas(result_va);
			results_data2 = [];
			results_data2.push({'key': 'Indicator Category', 'value': field_meta['category_name']});
			results_data2.push({'key': 'Indicator Name', 'value': field_meta['label_tx']});
			results_data2.push({'key': 'Units', 'value': field_meta['units_tx']});
			results_data2.push({'key': 'Statistic', 'value': field_meta['statistic_cd']});
			results_data2.push({'key': 'Aggregated Value', 'value': result_tx});

			// if (data.attribute_results['us_count_nu'] > 0)
			// {
			// 	results_data2.push({'key': 'Upstream HUC Value', 'value': data.attribute_results['us_value'] + ' ' + data.attribute_results['units']});
			// }
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

	/*
	* Start of code to support Aggregate Indicators
	*
	*
	*
	 */
	dojo.query('#category').on('change', function() {
		if (this.value == 'NONE')
		{
			var attribute_select = document.getElementById('attribute');

			attribute_select.options.length = 0;
			var o = document.createElement("option");
			o.value = 'NONE';
			o.text = '--- Select ----';
			attribute_select.appendChild(o);
		}
		else
		{
			updateIndicator(this.value);
		}

	});
	function updateIndicator(category_name)
	{
		if (category_name !== null)
		{
			var request = esriRequest({
			  url: navigator_url + '/api/wbdattributes/',
			  content: {
				'category_name': category_name
			  },
			  handleAs: "json"
			});
			NProgress.start();

			request.then(categorySucceeded, categoryFailed);
		}
	}
	function categorySucceeded(data)
	{
		var attribute_select = document.getElementById('attribute');

		//TODO: do this in a dojo/dijit way, instead of straight javascript
		attribute_select.options.length = 0;
		var o = document.createElement("option");
		o.value = 'NONE';
		o.text = '--- Select ----';
		attribute_select.appendChild(o);

		for (var i = 0; i < data.data.length; i++) {
			var o = document.createElement("option");

			o.value = data.data[i].field_nm;

			o.text = data.data[i].label_tx + " [" + data.data[i].statistic_cd + "]";

			attribute_select.appendChild(o);
		}
		// enable Recompute Aggregate
		var recompute_button = document.getElementById('recomputeAggregate');
		recompute_button.disabled = true;
		NProgress.done();
	}
	function categoryFailed(data)
	{
		var attribute_select = document.getElementById('attribute');

		alert('Error:' + data);
		NProgress.done();
		attribute_select.options.length = 0;
		var o = document.createElement("option");
		o.value = 'NONE';
		o.text = '--- Select ----';
		attribute_select.appendChild(o);
	}

	dojo.query('#attribute').on('change', function() {
		var huc_code_input = document.getElementById("navigation_huc_code");
		if (huc_code_input.value.length == 12) {
			// enable Recompute Aggregate
			var recompute_button = document.getElementById('recomputeAggregate');
			recompute_button.disabled = false;
		};
	});

	dojo.query('#recomputeAggregate').on('click', function() {
		// /wbd/huc/170401040901/upstream/?format=json&attribute_only&navigation_direction=Upstream&attribute_field_nm=FRUITYIELD
		var huc_code_input = document.getElementById("navigation_huc_code");

		var category = document.getElementById("category");
		var category_name = category.options[category.selectedIndex].value;

		var attribute = document.getElementById("attribute");
		var attribute_name = attribute.options[attribute.selectedIndex].value;
		var attribute_text = attribute.options[attribute.selectedIndex].text;

		if (huc_code_input.value.length == 12 && attribute_name.length > 0) {

		}
			var request = esriRequest({
			  url: navigator_url + '/wbd/huc/' + huc_code_input.value + '/upstream/',
			  content: {
			  	'navigation_direction': 'Upstream',
				'attribute_field_nm': attribute_name,
				'attribute': attribute_name,
				'attribute_only': true,
				'format': 'json'

			  },
			  handleAs: "json"
			});
		results_data2 = [];
		results_data2.push({'key': 'Indicator Category', 'value': category_name});
		results_data2.push({'key': 'Indicator Name', 'value': attribute_text});
		results_data2.push({'key': 'Units', 'value': 'Fetching ...'});
		results_data2.push({'key': 'Statistic', 'value': 'Fetching ...'});
		results_data2.push({'key': 'Aggregated Value', 'value': 'Fetching ...'});

		// if (data.attribute_results['us_count_nu'] > 0)
		// {
		// 	results_data2.push({'key': 'Upstream HUC Value', 'value': data.attribute_results['us_value'] + ' ' + data.attribute_results['units']});
		// }
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
			NProgress.start();
			t0 = performance.now();
			request.then(recomputeSucceeded, recomputeFailed);
	});

	function recomputeSucceeded(data)
	{
		var t1 = performance.now();
		console.log("++ indicator recompute finished in " + (t1 - t0).toFixed(3) + "ms");

		results_data2 = [];
		if ( ! data['attribute_data']['aggregated_attribute'].hasOwnProperty('attribute_field_nm'))
		{

		}
		else
		{
			var attribute_name = data['attribute_data']['aggregated_attribute']['attribute_field_nm'];

			// enable Recompute Aggregate
			var recompute_button = document.getElementById('recomputeAggregate');
			recompute_button.disabled = true;

			var field_nm = data['attributes']['attributes_tx'];
			var field_meta = data['attributes']['sanitized']['valid_attributes'][attribute_name];

			//TODO: figure out data handling better
			result_tx = '';
			if (data['attribute_data']['aggregated_attribute'].hasOwnProperty('result_va'))
			{
				var result_va = data['attribute_data']['aggregated_attribute']['result_va'];
				result_tx = numberWithCommas(result_va);
			}




			results_data2.push({'key': 'Indicator Category', 'value': field_meta['category_name']});
			results_data2.push({'key': 'Indicator Name', 'value': field_meta['label_tx']});
			results_data2.push({'key': 'Units', 'value': field_meta['units_tx']});
			results_data2.push({'key': 'Statistic', 'value': field_meta['statistic_cd']});
			results_data2.push({'key': 'Aggregated Value', 'value': result_tx});
		}


		// if (data.attribute_results['us_count_nu'] > 0)
		// {
		// 	results_data2.push({'key': 'Upstream HUC Value', 'value': data.attribute_results['us_value'] + ' ' + data.attribute_results['units']});
		// }
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
		NProgress.done();
	}
	function recomputeFailed(data)
	{
		alert('boo!' + data);
		NProgress.done();
	}
	/*
	* End of code to support Aggregate Indicators
	*
	*
	*
	 */


});


function copyToClipboard(copyText) {
	window.prompt("Copy URL to clipboard: Ctrl+C, Enter", copyText);
	return false;
}

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
function chkNumeric(evt) {
	evt = (evt) ? evt : window.event;
	var charCode = (evt.which) ? evt.which : evt.keyCode;
	if (charCode > 31 && (charCode < 48 || charCode > 57)) {
		if (charCode == 46) { return true; }
		else { return false; }
	}
	return true;
}
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
		  "color": [222, 0, 0, 100]
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