
// the SETTINGS.URLS is loaded from from urls.js (or urls_production.js)
// which is loaded via the HTML file.

//NOTE: TODO: update my datatables and use grouping on classification_display

$(function () {

    var is_superuser = false;

    var SETTINGS = { 'URLS': { 'wbdattributes_list': '/api/wbdattributes?format=datatables' }};

    /* Binding */
    $(document).ready(function() {

        loadTable();
    });
        // 'source_tx',
        // 'sort_nu',
        // 'category_name',
        // 'rest_layer_name',
        // 'label_tx',
        // 'field_nm',
        // 'statistic_cd',
        // 'units_tx',
        // 'description_tx'
    var loadTable = function() {

        var options = {
            "serverSide": true,
            "responsive": true,
            "ajax": SETTINGS.URLS.wbdattributes_list,
            "paging": true,
            "info" : true,
            "dom": 'Bfrtip',
            "buttons": [
                { 'extend': 'copy'},
                { 'extend': 'csv'},
                { 'extend': 'excel'},
                { 'extend': 'pdf'},
                { 'extend': 'print'},
            ],
            "columns": [
                // Use dot notation to reference nested serializers.
                {"data": "sort_nu", "searchable": true},
                {"data": "source_tx", "searchable": true},
                {"data": "category_name", "searchable": true},
                {"data": "field_nm", "searchable": true},

                {"data": "label_tx", "searchable": true},
                {"data": "units_tx", "searchable": true},
                {"data": "statistic_cd", "searchable": true},
                {"data": "description_tx", "searchable": true},

             ],
            "order": [[0, 'asc']],
            "initComplete": function () {
                this.api().columns('.searchSource').every( function () {
                    var column = this;
                    var select = $('<select><option value=""></option></select>')
                        .appendTo( $("#structures-table thead tr:eq(0) th").eq(column.index()).empty() )
                        .on( 'change', function () {
                            var val = $.fn.dataTable.util.escapeRegex(
                                $(this).val()
                            );

                            column
                                .search( val ? '^'+val+'$' : '', true, false )
                                .draw();
                        } );
                    var options2 = [
                                    'Service2016',
                                    'Service2017',
                    ];
                    $.each(options2, function ( d, j ) {
                        select.append( '<option value="'+j+'">'+j+'</option>' )
                    } );
                } );
                this.api().columns('.searchCategory').every( function () {
                    var column = this;
                    var select = $('<select><option value=""></option></select>')
                        .appendTo( $("#structures-table thead tr:eq(0) th").eq(column.index()).empty() )
                        .on( 'change', function () {
                            var val = $.fn.dataTable.util.escapeRegex(
                                $(this).val()
                            );

                            column
                                .search( val ? '^'+val+'$' : '', true, false )
                                .draw();
                        } );
                    var options2 = [
                                    'Carbon Storage',
                                    'Crop Productivity',
                                    'Energy Potential',
                                    'Engagement with Outdoors',
                                    'Impaired Waters',
                                    'Land Cover: Near-Water',
                                    'Land Cover: Type',
                                    'Landscape Pattern',
                                    'Near-Road Environments',
                                    'Pollutant Reduction: Water',
                                    'Pollutants: Nutrients',
                                    'Population Distribution',
                                    'Protected Lands',
                                    'Species: At-Risk and Priority',
                                    'Species: Other',
                                    'Water Supply, Runoff, and Flow',
                                    'Water Use',
                                    'Weather and Climate',
                                    'Wetlands and Lowlands',
                    ];
                    $.each(options2, function ( d, j ) {
                        select.append( '<option value="'+j+'">'+j+'</option>' );
                        console.log ('<option value="'+j+'">'+j+'</option>' );
                    } );
                } );
                this.api().columns('.searchUnits').every( function () {
                    var column = this;
                    var select = $('<select><option value=""></option></select>')
                        .appendTo( $("#structures-table thead tr:eq(0) th").eq(column.index()).empty() )
                        .on( 'change', function () {
                            var val = $.fn.dataTable.util.escapeRegex(
                                $(this).val()
                            );

                            column
                                .search( val ? '^'+val+'$' : '', true, false )
                                .draw();
                        } );
                    var options2 = [
                                    '%',
                                    'acres',
                                    'count',
                                    'count per pixel',
                                    'dollars per year',
                                    'hectares',
                                    'inches per year',
                                    'kWh/m2/day',
                                    'kg-N/ha per year',
                                    'kg-P/ha/yr',
                                    'kg-S/ha per year',
                                    'km',
                                    'km/km2',
                                    'km2',
                                    'meters',
                                    'metric tons',
                                    'metric tons per year',
                                    'millimeters of water',
                                    'million gallons per day',
                                    'million of gallons',
                                    'number per year',
                                    'thousands of tons per year',
                                    'tons per year',
                                    'unitless',

                    ];
                    $.each(options2, function ( d, j ) {
                        select.append( '<option value="'+j+'">'+j+'</option>' )
                    } );
                } );
            }
        };

        // hide the user column if the user is not a super user - the values should all be that particular user
        // if (is_superuser == false)
        // {
        // options['columnDefs'].push({
        //         "targets": 0,
        //         "visible": false
        //     }
        // )
        // }

        var table = $('#structures-table').DataTable(options);

        // buildSelect( table );
        //
        // table.on( 'draw', function () {
        //     buildSelect( table );
        // } );
    };


    function buildSelect( table ) {
      table.columns().every( function () {
        var column = table.column( this, {search: 'applied'} );
        var select = $('<select><option value=""></option></select>')
        .appendTo( $(column.footer()).empty() )
        .on( 'change', function () {
          var val = $.fn.dataTable.util.escapeRegex(
            $(this).val()
          );

          column
          .search( val ? '^'+val+'$' : '', true, false )
          .draw();
        } );

        column.data().unique().sort().each( function ( d, j ) {
          select.append( '<option value="'+d+'">'+d+'</option>' );
        } );

        // The rebuild will clear the exisiting select, so it needs to be repopulated
        var currSearch = column.search();
        if ( currSearch ) {
          select.val( currSearch.substring(1, currSearch.length-1) );
        }
      } );
    }


});
