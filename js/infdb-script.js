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
// v0.3
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
  var maxColumnReturned = 100; // maximum number of columns that'll be shown in the summary tables


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

    populateInfluxVars();
    influxQueryData = "q=SHOW DATABASES";
    influxURL = influxProto + influxHost + ":8086/query?" + influxAuthString;
    debugLog("calling influxquery");
    influxQuery(showDatabases);
  });





  //
  // Hit the button to submit query from textarea
  //
  $( "#submitquery" ).click(function () {
    if (!selectedDatabase) {
      debugLog("submitquery clicked but no table selected");
      $("#queryresults").text("No database selected, please update the list of databases and pick which one to use. ");  
      return false;
    }
    // need to send certain queries via GET and POST, for now all goes via GET but this will work in future!
    // if running SELECT or INSERT then we need to have picked a database
    var lowerQueryText = $("textarea#dbquery").val().toLowerCase();
    switch (lowerQueryText.substr(0,6)) {
      case "select":
      case "insert":
        debugLog("found select or insert query"); 
    }  
    influxQueryData = "q=" + $("textarea#dbquery").val();
    influxURL = influxProto + influxHost + ":8086/query?db=" + selectedDatabase + "&" + influxAuthString;
    influxQuery(showQuery);
  });



  //
  // Hit the show measurements button
  //
  $( "#showmeasurements" ).click(function () {
    if (!selectedDatabase) {
      debugLog("showmeasurements clicked but no table selected");
      $("#browseoutput").text("No database selected, please update the list of databases and pick which one to use.");  
      return false;
    }
    output = "";
    // obtain list of measurements in this table
    influxQueryData = "q=SHOW MEASUREMENTS";
    influxURL = influxProto + influxHost + ":8086/query?db=" + selectedDatabase + "&" + influxAuthString;
    influxQuery(gotMeasurements);
  });





  //
  // fires when an entry in the list of databases is clicked
  //
  function dbListItemClicked() {
    debugLog("dblistitem clicked");
    selectedDatabase = $(this).val();
    debugLog("Clicked list item - " + selectedDatabase);
    // put text in the menu bar showing this db is selected
    $("#selectdbspan").text(".  Currently Selected: " + selectedDatabase);
    // empty the browser and query outputs
    $("#browseoutput").html("");
    $("#queryresults").html("");
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



  // Runs query from influxQueryData and renders the output in the queryresults div
  function showQuery(result) {
    if (result) {

      debugLog("showQuery got: " + JSON.stringify(dataResponse));  
      var output = "";

      // check if there's any results to render
      if (("series" in dataResponse.results[0]) == false) {
        debugLog("dataresponse contained no results");
        $("#queryresults").text("no results from query");
        return true; 
      }

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

  

  // callback from influxQuery that populates the list of databases
  function showDatabases(result) {
    if (result) {
      debugLog("showDatabases got: " + JSON.stringify(dataResponse));  
      
      var output = "";
      for (var i=0 ; i< dataResponse.results[0].series[0].values.length ; i++) {
        // extract db name and cast it to a string
        var db = dataResponse.results[0].series[0].values[i].toString();
        // strip any non-alphanumerics to avoid XSS/etc - note this may be a bit harsh and block unexpected DB names
        // if databases aren't selectable for any reason then this is probably the cause !
        db = db.replace(/[^a-z0-9_\-\s]/gi, '');
        debugLog("found database: " + db + " as " + typeof(db));
        output = output + "<div class=\"form-check\"><input class=\"form-check-input dbselectradio\" type=\"radio\" name=\"selectedDB\" id=\""+db+"\" value=\""+db+"\"><label class=\"form-check-label\" for=\"selectedDB\">"+db+"</label></div>";
        databaseList.push(db);
      }
      $("#databaselist").html(output);

      // Attach a click event to the newly created dropdown items so it fires function to pick the database
      $('input[type=radio][name="selectedDB"]').on('change', '', dbListItemClicked );

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
        // extract user name and cast it to a string
        var user = dataResponse.results[0].series[0].values[i][0].toString();
        // strip any non-alphanumerics to avoid XSS/etc - note this may be a bit harsh and block unexpected user names
        user = user.replace(/[^a-z0-9_\-\s]/gi, '');
        debugLog("found user: " + user);
        output = output + "<br>\n" + user;
      }
      $("#userlist").html(output);
    } else {
      debugLog("ifluxquery returned false");
      $("#userlist").text("Failed to get list of users");  
    }

  }



    // This one deals with output of "SHOW MEASUREMENTS" and puts each returned measurement into array $measurementList
    // then fires off the process to find all the columns for each one. 
    function gotMeasurements(result) {
      debugLog("gotMeasurements got: " + JSON.stringify(dataResponse)); 

      // firstly set the output to showing a spinner
      $("#browsewait").html("<div class=\"spinner-border\" role=\"status\"><span class=\"sr-only\">Loading...</span></div>");
      $("#browseoutput").html("&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Loading...");

      if (result) {
        debugLog("gotMeasurements with result");
        if (("series" in dataResponse.results[0]) == false) { // check we have some results
          debugLog("dataresponse contained no results");
          // turn off spinner
          $("#browsewait").html("");
          $("#browseoutput").text("Database is empty");
          return true; 
        }

        // wipe any existing array info
        measurementList = $.makeArray();
       
        var output = "";

        for (var i=0 ; i< dataResponse.results[0].series[0].values.length ; i++) { 
          var measurement = dataResponse.results[0].series[0].values[i]
          debugLog("found measurement: " + measurement);
          measurementList.push(measurement);
        }
        debugLog("wrote " + i + " entries to measurementList");
      
        // show all the measurements in a table, ready to be populated with column info later
        // column info format is <span id="columns-<ID>"> where ID is the index in the measurementList array
        if (measurementList.length > maxMeasurementReturned) {
          maxList = maxMeasurementReturned;
          output = output + "Limiting measurements to " + maxMeasurementReturned + " due to browser performance problems.<br><br>";
        } else {
          maxList = measurementList.length;
        }
    
        debugLog("maxlist set to " + maxList);

        // create a table with measurements in first column and columns in the second
        output = output + "<table class=\"table table-bordered\">\n<thead>\n<tr>\n<th scope=\"col\">Measurement</th>\n<th scope=\"col\">Rows</th>\n</tr>\n</thead><tbody>";

        // for each measurement found, create a row entry in the table
        for ( i = 0 ; i < maxList ; i++ ) { 
          output = output + "<tr><td><a class=\"\" href=\"#\">"+measurementList[i]+"</a></td>";
          // stick a spinner in the column field as well populate it later
          colOutput = "<span id=\"columns-"+i+"\"><div class=\"spinner-border\" role=\"status\"><span class=\"sr-only\">Loading...</span></div></span>"
          output = output + "<td>"+colOutput+"</td></tr>"; 
        }

        output = output + "</tbody></table><br>";
        debugLog("read " + i + " entries from measurementsList");
    
        // turn off spinner 
        $("#browsewait").html("");
        
        // display the table so far (just measurements, no column data)
        $("#browseoutput").html(output);  
        
        // fire off process to populate the list of columns
        showColumns();

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


    // called once list of measurements has been populated
    function showColumns() {
      // firstly limit how many measurements we'll check to avoid huge databases jamming up the browser
      if (measurementList.length > maxMeasurementReturned) {
        maxList = maxMeasurementReturned;
      } else {
        maxList = measurementList.length;
      }
      debugLog("maxlist set to " + maxList);
      
      // for each measurement, get a list of the columns and send it back to getColumns function with the index as an additional argument (so it can work out where to put the row information in the table)
      for ( i = 0 ; i < maxList ; i++ ) { 
        influxQueryData = "q=SELECT * FROM \"" + measurementList[i] + "\" LIMIT 1";
        influxURL = influxProto + influxHost + ":8086/query?db=" + selectedDatabase + "&" + influxAuthString;
        influxQuery(getColumns, i);
      }
    }

  // populates columns array with list of all columns in query - should be called with results of "SELECT * FROM table LIMIT 1"
  // outputs to span with id = column-<ID> where ID is the value passed as measurementListIndex
    function getColumns(result, measurementListIndex) {
      if (result) {

        debugLog("getColumns got: " + JSON.stringify(dataResponse)); 
        debugLog("getColumns index : " + measurementListIndex + " which is measurement " + measurementList[measurementListIndex]); 

        // if zero columns
        if (("series" in dataResponse.results[0]) == false) {
          debugLog("dataresponse contained no results");
          $("#columns-" + measurementListIndex).text("No rows in measurement.");
          return true; 
        }

        // limit how many columns we'll show to avoid huge tables killing the browser
        numCols = dataResponse.results[0].series[0].columns.length;
        if (numCols > maxColumnReturned ) {
          $("#columns-" + measurementListIndex).text("Table has " + numCols + " columns, not showing in summary");
          debugLog("not checking table for performance reasons");
          return true;
        } 
        var output = "";
        for (var i=0 ; i< numCols  ; i++) {
          var column = dataResponse.results[0].series[0].columns[i]
          debugLog("found column: " + column);
          if (i>0) { // work out if it needs a comma or not
            output = output + ", " + column;
          } else {
            output = output +  column;
          }
        }
        $("#columns-" + measurementListIndex).text(output);
        

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
  // not currently used as this causes massive delays on big databases
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

  
  // This runs a query against Influx and sends the response to the callback function passed as an argument. 
  // Can also send additional data to the callback function as second argument, will be ignored if not defined. 
  function influxQuery(callBackFunc, extraData) {
    
    debugLog("influxQuery() - URL " + influxURL + " - query:  " + influxQueryData);
    dataResponse = false;
    
    $.ajax({
        type: "POST",
        url: influxURL,
        data: influxQueryData,
        dataType: "json",
        contentType: "application/x-www-form-urlencoded",
        cache: false,
        success: function (data) {
          dataResponse = data;
          debugLog("influxQuery SUCCESS : ", dataResponse);
          if (typeof(extraData)==='undefined') {
            callBackFunc(1); 
          } else {
            callBackFunc(1,extraData); 
          }
         
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
