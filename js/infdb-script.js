//
// Basic single page webapp for talking to InfluxDB 1.x
//
// https://github.com/unixhead/InfluxSPA
//
// Beerware - do what you want, provided you leave the link and this license, then buy me a beer at some point if you like it.
//
// coding convention attempts to follow:
// https://www.w3schools.com/js/js_conventions.asp
//
// v0.1
//



$(function () {

  var debugMode = true;
  var influxURL = "";
  var influxHost = "";
  var influxAuth = true;
  var influxUsername = "";
  var influxPassword = "";
  var influxAuthString = "";
  var influxProto = "https://"; 
  var dataResponse = "";
  var influxQueryData = "";
  var databaseList = $.makeArray();
  var measurementList = $.makeArray();
  var columnList = $.makeArray();
  var dropdowndbpopulated = false;
  var selectedDatabase = false;
  var rowCount = 0;
  var maxMeasurementReturned = 50; // maximum number of measurements that'll be shown in the summary tables
  var maxColumnReturned = 20; // maximum number of columns that'll be shown in the summary tables


  //
  // Clicked the "test connection" button
  //
  $( "#testconnection" ).click(function () {
    populateInfluxVars();
    connectTest();
  });


  //
  // server protocol drop-down changed
  //
  $('.serverprotoopt').click(function () {
    var proto = $(this).text();
    influxProto = proto;
    $("#serverproto").text(proto);
    debugLog('Serverproto dropdown setting protocol as: ' + influxProto);
    populateInfluxVars();
    return 1;
  });


  //
  // enabled/disabled authentication
  //
  $('#authreqd').click(function () {
    if($('#authreqd').is(':checked')) {
        debugLog("enabling auth");
        $('#databaseuser').prop('readonly', false);
        $('#databasepass').prop('readonly', false);
        influxAuth = true;
    } else {
        debugLog("disabling auth");
        $('#databaseuser').prop('readonly', true);
        $('#databasepass').prop('readonly', true);
        influxAuth = false;
    }
    return 1;
  }); 


  //
  // changed one of the fields relating to URL/access
  //
  $('.dburl').change(function () { //OR $('#dob').on('change',function ()
    debugLog("field changed: " + $(this).text());
    populateInfluxVars();
  });


  // fill out db variables from form fields
  function populateInfluxVars() {
    influxHost = $("#databasehost").val();
    influxUsername = $("#databaseuser").val();
    influxPassword = $("#databasepass").val();
    if (influxAuth)  {
      influxAuthString = "u=" + influxUsername + "&p=" + influxPassword;
    }
    influxURL = influxProto + influxHost + ":8086/ping?" + influxAuthString;
    debugLog("populatevars, test url set to " + influxURL);
    return 1;
  }


  //
  // Clicked the "list databases" button
  //
  $( "#getdatabases" ).click(function () {
    getDatabases();
  });





  //
  // Hit the button to submit query from textarea
  //
  $( "#submitquery" ).click(function () {
    // if running SELECT or INSERT then we need to have picked a database
    var lowerQueryText = $("textarea#dbquery").val().toLowerCase();
    switch (lowerQueryText.substr(0,6)) {
      case "select":
      case "insert":
        debugLog("found select query");
        if (!selectedDatabase) {
          $("#queryresults").text("Need to select a database to run this query, Update the list of databases to populate the menu.");   
          return false;
        } 
    }  
    influxQueryData = "q=" + $("textarea#dbquery").val();
    influxURL = influxProto + influxHost + ":8086/query?db=" + selectedDatabase + "&" + influxAuthString;
    influxQuery(showQuery);
  });



  //
  // Hit the show DB details button
  //
  $( "#showtabledetails" ).click(function () {
    if (!dropdowndbpopulated) {
      debugLog("Showtabledetails clicked but no table selected");
      return false;
    }
    output = "";
    // first of all obtain list of measurements in this table
    influxQueryData = "q=SHOW MEASUREMENTS";
    influxURL = influxProto + influxHost + ":8086/query?db=" + selectedDatabase + "&" + influxAuthString;
    influxQuery(gotMeasurements);
    debugLog("gotMeasurements returned to showtabledetails clicked");
    // if there's more than 10 measurements then don't run this as it'll kill the browser
    if (measurementList.length > maxMeasurementReturned) {
      maxList = maxMeasurementReturned;
      output = output + "Limiting measurements to " + maxMeasurementReturned + " due to browser performance problems.<br><br>";
    } else {
      
      maxList = measurementList.length;
    }

    debugLog("maxlist set to " + maxList);
    if (maxList === 0) {
      debugLog("found zero");
      // empty DB
      $("#queryresults").text("Database is empty");
      return true; 
    }

    output = output + "<table class=\"table table-bordered\">\n<thead>\n<tr>\n<th scope=\"col\">Measurement</th>\n<th scope=\"col\">Rows</th>\n</tr>\n</thead><tbody>";

    // for each measurement, get a list of the columns
    for ( i = 0 ; i < maxList ; i++ ) { 
      output = output + "<tr><td><a class=\"\" href=\"#\">"+measurementList[i]+"</a></td>";
      debugLog("checking " + measurementList[i]);
      influxQueryData = "q=SELECT * FROM " + measurementList[i] + " LIMIT 1";
      influxURL = influxProto + influxHost + ":8086/query?db=" + selectedDatabase + "&" + influxAuthString;
      influxQuery(getColumns);
      // columnList is now populated
      colOutput = "";
      for ( n=0 ; n < columnList.length ; n++ ) {
        if (n < columnList.length) { // decides if we need a comma, if htere's more columns listed
          colOutput = colOutput + columnList[n] + ", ";
        } else {
          colOutput = colOutput + columnList[n];
        }
        
      }
      output = output + "<td>"+colOutput+"</td></tr>";
      // find number of entries in the table - Blocking this as it is really slow on big tables
      //influxQueryData = "q=SELECT COUNT(*) FROM " + measurementList[i];
      //influxURL = influxProto + influxHost + ":8086/query?db=" + selectedDatabase + "&" + influxAuthString;
      //influxQuery(getRowCount);

      //output = output + rowCount + "<br>";

     
    }
    output = output + "</tbody></table><br>";
    //debugLog("outputting + " + output)
    debugLog("read " + i + " entries from measurementsList");


    // display output
    $("#queryresults").html(output);  
  });


  //
  // triggers when user opens the list of databases for a query - need to populate it if first time opening
  //
  $("#dropdowndbbutton").click(function () {
    debugLog("dropdowndbbutton Clicked!")
    if (databaseList.length < 1) {
      getDatabases();
      return true;
    }
    // if not populated then fill out the list
    if (!dropdowndbpopulated) {
      debugLog("populating list of databases");  
      var i;
      var output = "";
      for ( i = 0 ; i < databaseList.length ; i++ ) { 
        output = output + "<a class=\"dropdown-item dblistitem\" href=\"#\">"+databaseList[i]+"</a>";
      }
      $("#dbmenu").html(output);
      debugLog(output);
      // Attach a click event to the newly created dropdown items so it fires function to pick the database
      $('#dbmenu').on('click', 'A', dbListItemClicked );
      dropdowndbpopulated = true;
    }

  });


  //
  // fires when an entry in the dropdown list of databases is clicked, need to update the main button to show the selected item
  //
  function dbListItemClicked() {
    debugLog("dblistitem clicked");
    if (!dropdowndbpopulated) {
      return false;
    }
    selectedDatabase = $(this).text();
    debugLog("Clicked list item - " + selectedDatabase);
    $("#dropdowndbbutton").text(selectedDatabase);
    // make the "show Details button appear clickable" - showtabledetails
    $("#showtabledetails").removeClass();
    $("#showtabledetails").addClass("btn btn-primary");
    // wipe the output
    $("#queryresults").text("");  
  }


  //
  // populates the list of users
  //
  $( "#getusers" ).click(function () {
    populateInfluxVars();
    influxQueryData = "q=SHOW USERS";
    influxURL = influxProto + influxHost + ":8086/query?" + influxAuthString;
    debugLog("calling influxquery");
    influxQuery(showUsers)
  });


  // Will be used to get list of retention policies on the database
  function getDBPolicies() {
    var i;
    for ( i = 0 ; i < databaseList.length ; i++ ) {
      influxQueryData = "q=SHOW RETENTION POLICIES ON " + databaseList[i];
      influxQuery(showDBPolicies);
    }

  }

  // Will be used to render list of retention policies on the database
  function showDBPolicies(result) {
    if (result) {
      debugLog("showDBPolicies got: " + JSON.stringify(dataResponse));  
      //$("#databaselist").text(dbList.results.databases[0].name);
      var output = "";
      for (var i=0 ; i< dataResponse.results[0].series[0].values.length ; i++) {
        var db = dataResponse.results[0].series[0].values[i]
        debugLog("found got response: " + db);
      }
      //$("#databaselist").html(output);
    } else {
      debugLog("ifluxquery returned false");
      //$("#databaselist").text("Failed to get list of databases");  
    }  
  }


  // populates the list of DBs
  function getDatabases() {
    populateInfluxVars();
    influxQueryData = "q=SHOW DATABASES";
    influxURL = influxProto + influxHost + ":8086/query?" + influxAuthString;
    debugLog("calling influxquery");
    influxQuery(showDatabases);
  }


  // Runs query from influxQueryData and returns output to the passed callback function
  function showQuery(result) {
    if (result) {

      debugLog("showQuery got: " + JSON.stringify(dataResponse));  
      //$("#databaselist").text(dbList.results.databases[0].name);
      var output = "";
      for (var i=0 ; i< dataResponse.results[0].series[0].values.length ; i++) {
        debugLog("Response: " + dataResponse.results[0].series[0].values[i]);
        output = output + "<br>\n" + dataResponse.results[0].series[0].values[i]
      }
      $("#queryresults").html(output);

    } else {

      if (dataResponse) {
        // query failed but may have some info in the response that indicates why
        $("#queryresults").html(dataResponse);
      } else {
        debugLog("ifluxquery returned false");
        // X-Influxdb-Error
        $("#queryresults").text("Failed to run query");  
      }

    }
  }

  

  // callback that populates the list of databases
  function showDatabases(result) {
    if (result) {
      debugLog("showDatabases got: " + JSON.stringify(dataResponse));  
      //$("#databaselist").text(dbList.results.databases[0].name);
      var output = "Databases:<br>\n";
      for (var i=0 ; i< dataResponse.results[0].series[0].values.length ; i++) {
        var db = dataResponse.results[0].series[0].values[i]
        debugLog("found database: " + db);
        output = output + "<br>\n" + db;
        databaseList.push(db);
      }
      $("#databaselist").html(output);
      // sort out the dropdown in the query box           
      $("#dropdowndbbutton").removeClass();
      $("#dropdowndbbutton").addClass("btn btn-primary dropdown-toggle");
      $("#dropdowndbbutton").text("Select Database");
    } else {
      debugLog("ifluxquery returned false");
      $("#databaselist").text("Failed to get list of databases");  
    }

  }



  // Callback - gets query response containing list of users.
  function showUsers(result) {
    if (result) {
      debugLog("showUsers got: " + JSON.stringify(dataResponse));  
      //$("#databaselist").text(dbList.results.databases[0].name);
      var output = "Users:<br>\n";
      for (var i=0 ; i< dataResponse.results[0].series[0].values.length ; i++) {
        debugLog("found user: " + dataResponse.results[0].series[0].values[i][0]);
        output = output + "<br>\n" + dataResponse.results[0].series[0].values[i][0]
      }
      $("#userlist").html(output);
    } else {
      debugLog("ifluxquery returned false");
      $("#userlist").text("Failed to get list of users");  
    }

  }



    // This one deals with output of "SHOW MEASUREMENTS" and puts each returned measurement into array $measurementList
    function gotMeasurements(result) {
      if (result) {
        // wipe any existing array info
        measurementList = $.makeArray();
        debugLog("gotMeasurements got: " + JSON.stringify(dataResponse)); 
        var output = "";
        for (var i=0 ; i< dataResponse.results[0].series[0].values.length ; i++) {
          var measurement = dataResponse.results[0].series[0].values[i]
          debugLog("found measurement: " + measurement);
          output = output + "<br>\n" + measurement;
          measurementList.push(measurement);
        }
        //$("#queryresults").html(output);
        debugLog("wrote " + i + " entries to measurementList");
      } else {
        debugLog("gotMeasurements with no result");
        if (dataResponse) {
          // query failed but may have some info in the response that indicates why
          $("#queryresults").html(dataResponse);
        } else {
          debugLog("ifluxquery returned false");
          // X-Influxdb-Error
          $("#queryresults").text("Failed to run query");  
        }
  
      }
    }


  // populates columns array with list of all columns in query - should be called with results of "SELECT * FROM table LIMIT 1"
    function getColumns(result) {
      if (result) {
        // wipe any existing array info
        columnList = $.makeArray();
        debugLog("getColumns got: " + JSON.stringify(dataResponse)); 
        var output = "";
        numCols = dataResponse.results[0].series[0].columns.length;
        if (numCols > maxColumnReturned ) {
          columnList.push("Table has " + numCols + " columns, not showing in summary");
          debugLog("not checking table for performance reasons");
          return true;
        } 
        for (var i=0 ; i< numCols  ; i++) {
          var column = dataResponse.results[0].series[0].columns[i]
          debugLog("found column: " + column);
          output = output + "<br>\n" + column;
          columnList.push(column);
        }
        //$("#queryresults").html(output);
        debugLog("wrote " + i + " entries to columnList");
      } else {
        debugLog("getColumns with no result");
        if (dataResponse) {
          // query failed but may have some info in the response that indicates why
          $("#queryresults").html(dataResponse);
        } else {
          debugLog("ifluxquery returned false");
          // X-Influxdb-Error
          $("#queryresults").text("Failed to run query");  
        }
  
      }
    }


  // populates rowcount variable from results of  "SELECT count(*) FROM table"
  function getRowCount(result) {
    if (result) {
      // wipe any existing array info
      rowCount = 0;
      debugLog("getRowCount got: " + JSON.stringify(dataResponse)); 
      var output = "";
      for (var i=0 ; i< dataResponse.results[0].series[0].values.length ; i++) {
        rowCount = dataResponse.results[0].series[0].values[i][1]
        debugLog("found rowCount: " + rowCount);
      }
    } else {
      debugLog("getRowCount with no result");
      if (dataResponse) {
        // query failed but may have some info in the response that indicates why
        $("#queryresults").html(dataResponse);
      } else {
        debugLog("ifluxquery returned false");
        // X-Influxdb-Error
        $("#queryresults").text("Failed to run query");  
      }

    }
  }


  // Tests InfluxDB connection and updates a status indicator on the page
  function connectTest() {
    debugLog("connect() with url: " + influxURL);

    if (influxURL.length === 0) {  
      debugLog("Exiting - no URL provided");
      return false;
    }
    $success = false;
    $.ajax({
      type: "GET",
      url: influxURL,
      data: dataResponse,
      statusCode: {
        204: function (response) {
          debugLog('ConnectTest Reponse 200 - Server OK');
          $("#testResult").removeClass();
          $("#testResult").addClass("alert alert-success");
          $("#testResult").text("Connection OK");
          $success = true;
        },
        401: function (response) {
          debugLog('ConnectTest Reponse 401 - Authentication Failed');
          $("#testResult").removeClass();
          $("#testResult").addClass("alert alert-danger");
          $("#testResult").text("Authentication Failed");
          $success = true;
        }
      } 
    });
    if (!$success) {
      debugLog("ConnectTest failed (async call - may pass shortly afterwards)");
      $("#testResult").removeClass();
      $("#testResult").addClass("alert alert-danger");
      $("#testResult").text("Connection Failed");
    }
    return true;
  }

  
  // This runs a query against Influx and sends the response to a callback function
  function influxQuery(callBackFunc) {
    debugLog("influxQuery() - URL " + influxURL + " - query:  " + influxQueryData);
    dataResponse = false;
    
    $.ajax({
        type: "POST",
        url: influxURL,
        data: influxQueryData,
        dataType: "json",
        contentType: "application/x-www-form-urlencoded",
        cache: false,
        // async: false is not ideal but resolves UI rendering before DB query has returned, given this is a single page specific app then there is nothing else going on to block
        // however browsers might start ignoring it, so probably needs changing at some point
        async: false,
        success: function (data) {
          dataResponse = data;
          debugLog("influxQuery SUCCESS : ", dataResponse);
          callBackFunc(1);
        },
        error: function (e) {
          // actual error is in esponse header X-Influxdb-Error but can't read that using ajax
          debugLog("influxQuery ERROR : ", e);
          callBackFunc(0);
        }
    });
  }


  function debugLog(message) {
    if (debugMode) {
      console.log("DEBUG:" + message);
    }
  }

});
