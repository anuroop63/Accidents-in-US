var accident_report
var state_accident
var top5county
var dcUs

var squareLoadings
var eigenValues
var pcaData
var mdsData

var year_ndx
var stname_dim
var year_dim
var severity_dim

var timeChart
var usChart
var weatherChart
var accidentCountsND
var totalPopulationND
var accidentSeverityPieChart
var pop_dict = {};

var fontFamily = 'verdana';

queue()
    .defer(d3.json, "/get_squareloadings")
    .defer(d3.json, "/get_eigen_values")
    .defer(d3.json, "/pca_analysis")
    .defer(d3.json, "/mds_analysis")
    .defer(d3.json, "/accident_report")
    .defer(d3.json, "/top_county")
    .defer(d3.json, "static/geojson/us-states.json")
    .defer(d3.json, "/accident_state")
    .await(loadData);

function loadData(error, squareLoadingsJson, eigenValuesJson, pcaDataJson, mdsDataJson,
                    crimeReportJson, top5json, dcUsJson, state_accidentJson) {

    if (error) throw error;

    squareLoadings = squareLoadingsJson
    eigenValues = eigenValuesJson
    pcaData = pcaDataJson
    mdsData = mdsDataJson
    accident_report = crimeReportJson
    state_accident = state_accidentJson
    top5county = top5json
    dcUs = dcUsJson

    for (var i =0; i<state_accident.length; i++)
    {
        var key = state_accident[i]['State']
        var value = state_accident[i]['Population']
        pop_dict[key]=value
    }

    open_dashboard();
    calculate_dimension();
    calculate_intrinsic_dimensionality();
    calculate_pca();
    calculate_mds();
    document.getElementById("dashboard_button").click();
}


function* range(start, end) {
    yield start;
    if (start === end) return;
    yield* range(start + 1, end);
}

function open_dashboard() {

    year_ndx = crossfilter(accident_report);

    stname_dim = year_ndx.dimension(function(d) { return d["State"]; });
    year_dim = year_ndx.dimension(function(d) { return d["Year"]; });
    severity_dim = year_ndx.dimension(function(d) { return d["Severity"]; });
    weather_dim = year_ndx.dimension(function(d) { return d["Weather_Condition"]; });

    var all = year_ndx.groupAll();
    var numAccyear = year_dim.group();
    var total_accbystate = stname_dim.group().reduceSum(function(d) {return 1;});


    var minYear = year_dim.bottom(1)[0]["Year"];
    var maxYear = year_dim.top(1)[0]["Year"];

    var accbyseverity = severity_dim.group();
    var acc_weather = weather_dim.group();


    timeChart = dc.barChart("#time-chart");
    weatherChart = dc.rowChart("#weather-barchart");
    usChart = dc.geoChoroplethChart("#us-chart");
    accidentCountsND = dc.numberDisplay("#accident-count");
    totalPopulationND = dc.numberDisplay("#population-count");
    accidentSeverityPieChart = dc.pieChart("#severity-piechart");

    accidentCountsND
    	.formatNumber(d3.format("d"))
    	.valueAccessor(function(d){return d; })
    	.group(all);


    totalPopulationND
    	.formatNumber(d3.format("d"))
    	.valueAccessor(function(d){return d*105; })
    	.group(all);


    timeChart
    	.width(680)
    	.height(310)
    	.margins({top: 10, right: 50, bottom: 30, left: 50})
          .colors(['#006837'])
    	.dimension(year_dim)
    	.group(numAccyear)
    	.transitionDuration(500)
          .x(d3.scale.linear().domain([minYear, maxYear]))
    	.elasticY(true)
    	.yAxisLabel("Accidents")
    	.yAxis().ticks(5);

    weatherChart
    	.width(330)
    	.height(310)
      .dimension(weather_dim)
      .group(acc_weather)
      .elasticX(true)
      .xAxis().ticks(4);

    usChart.width(1300)
    	.height(520)
    	.dimension(stname_dim)
    	.group(total_accbystate)
    	.overlayGeoJson(dcUs["features"], "state", function (d) {
    		return d.properties.name;})
      .colorDomain([0, 2000])
      .colorCalculator(function (d) {
        let x = d;
        if (x==undefined)
          {return "#C0C0C0";}
        if (x >= 0 && x < 15000) {
          return "#ffffe5";
        } else if (x >= 15001 && x < 30000) {
          return "#fff7bc";
        } else if (x >= 30001 && x < 45000) {
          return "#fee391";
        } else if (x >= 45001 && x < 60000) {
          return "#fec44f";
        } else if (x >= 60001 && x < 75000) {
          return "#fe9929";
        } else if (x >= 75001 && x < 90000) {
          return "#ec7014";
        } else if (x >= 90001 && x < 150000) {
          return "#cc4c02";
        } else if (x >= 150001 && x < 300000) {
          return "#993404";
        } else {
          return "#662506";
        }
      })
    	.projection(d3.geo.albersUsa()
      				.scale(900)
      				.translate([340, 250]))
    	.title(function (p) {
              var countyArr=top5county[p["key"]];
              if ( countyArr != undefined){
                  var data="\n\nCounties with most accidents:";
                  for (var j=0; j<countyArr.length; j++)
                      {
                          data = data+"\n"+countyArr[j]
                      }
              }
              else
                  {
                      data = ""
                  }

              return "State: " + p["key"]+ "\n"
                + "Total Population: " + pop_dict[p["key"]]+ "\n"
                + "Total Accidents: " + Math.round(p["value"])+ data
          })
     
    accidentSeverityPieChart
      .width(280)
      .height(310)
      .colors(["#d9f0a3","#addd8e","#78c679","#31a354"])
      .slicesCap(5)
      .innerRadius(50)
      .dimension(severity_dim)
      .group(accbyseverity)
      .renderLabel(true);

    dc.renderAll();

    var sampleNumerical = [15, 30, 45, 60, 75, 90, 150, 300];
    var sampleThreshold = d3.scale.threshold().domain(sampleNumerical)
                           .range(['#ffffe5','#fff7bc','#fee391','#fec44f','#fe9929','#ec7014','#cc4c02','#993404','#662506']);
    var horizontalLegend = d3.svg.legend().units("").cellWidth(30).cellHeight(10).inputScale(sampleThreshold).cellStepping(0);

    usChart.svg().append("g").attr("class", "legend-dash").attr("transform", "translate(0,495)").call(horizontalLegend);
    usChart.svg().append("text").attr("class", "x-axis-label").attr("transform", "translate(0,520)").text('Accidents on a scale of 1000s');


    function XAxisLabel(chartToUpdate, displayText)
      {
          chartToUpdate.svg()
                      .append("text")
                      .attr("class", "x-axis-label")
                      .attr("text-anchor", "middle")
                      .attr("x", chartToUpdate.width()/2-20)
                      .attr("y", chartToUpdate.height())
                      .text(displayText);
      }
      XAxisLabel(timeChart, "Year");
      XAxisLabel(weatherChart, "Accidents");
};


function calculate_dimension() {

    var data = eigenValues;
    var width = 600;
    var height = 400;
    var chart_width = 500;
    var chart_height = 450;

    var x = d3.scale.linear().domain([1, data.length + 0.5]).range([0, chart_width]);
    var y = d3.scale.linear().domain([0, d3.max(data) + 0.5]).range([chart_height, 0]);
    var xAxis = d3.svg.axis().scale(x).orient("bottom").ticks(9);
    var yAxis = d3.svg.axis().scale(y).orient("left");

    var markerX
    var markerY

    var line = d3.svg.line()
        .x(function(d,i) {
            if (i == 2) {
                markerX = x(i);
                markerY = y(d)
            }
            return x(i);
        })
        .y(function(d) { return y(d); })


    var svg = d3.select("#scree").append("svg")

    svg.append("g")
          .attr("class", "x_axis")
          .attr("transform", "translate(105," + chart_height + ")")
          .call(xAxis);

    svg.append("g")
          .attr("class", "y_axis")
          .attr("transform", "translate(100,0)")
          .call(yAxis);

    svg.append("text")
        .attr("class", "axis_label")
        .attr("text-anchor", "middle")
        .attr("transform", "translate("+ 50 +","+(height/2)+")rotate(-90)")
        .text("Eigen Values");

    svg.append("text")
        .attr("class", "axis_label")
        .attr("text-anchor", "middle")
        .attr("transform", "translate("+ ((chart_width/2 + 100)) +","+ (chart_height + 50) +")")
        .text("K");

    svg.append("text")
        .attr("class", "chart_name")
        .attr("text-anchor", "middle")
        .attr("transform", "translate(350,540)")
        .text("Scree Plot for Accidents in County Data");

    svg.append("path")
        .attr("class", "screepath")
        .attr("d", line(data))
        .attr("transform", "translate(165,0)");

    var th_line = svg.append("line")
        .attr("x1", markerX+172)
        .attr("y1", 0)
        .attr("x2", markerX+172)
        .attr("y2", 451)
        .attr("stroke-width", 2)
        .attr("stroke", "green")

    svg.append("circle")
        .attr("cx", markerX+7)
        .attr("cy", markerY)
        .attr("r", 6)
        .attr("transform", "translate(165,0)")
        .style("fill", "red")
        .style("stroke", "white")
}

function calculate_intrinsic_dimensionality() {

    loadingVector = squareLoadings;
    var feature_names = Object.keys(loadingVector);
    var feature_loadings = []
    for (var i=0; i<feature_names.length; i++) {
        var x = loadingVector[feature_names[i]];
        feature_loadings[i] = x.toFixed(5);
    }

    var width = 600;
    var bar_height = 40;
    var padding = 6;
    var left_width = 80;
    var height = (bar_height + padding) * feature_names.length;

    svg = d3.select("#dim_bar");
        
    var x = d3.scale.linear()
       .domain([0, d3.max(feature_loadings)])
       .range([0, width - 150]);

    var y = d3.scale.ordinal()
        .domain(feature_loadings)
        .rangeBands([0, (bar_height + 2 * padding) * feature_loadings.length]);

    var y2 = d3.scale.ordinal()
        .domain(feature_names)
        .rangeBands([0, (bar_height + 2 * padding) * feature_names.length]);

    var line = svg.selectAll("line")
       .data(x.ticks(10))
       .enter().append("line")
       .attr("class", "barline")
       .attr("x1", function(d) { return x(d) + left_width; })
       .attr("x2", function(d) { return x(d) + left_width; })
       .attr("y1", 0)
       .attr("y2", (bar_height + padding * 2) * feature_names.length);

    var rule = svg.selectAll(".rule")
       .data(x.ticks(10))
       .enter().append("text")
       .attr("class", "barrule")
       .attr("x", function(d) { return x(d) + left_width; })
       .attr("y", 0)
       .attr("dy", -6)
       .attr("text-anchor", "right")
       .attr("font-size", 10)
       .text(String);

    var rect = svg.selectAll("rect")
       .data(feature_loadings)
       .enter().append("rect")
       .attr("x", left_width)
       .attr("y", function(d) { return y(d) + padding; })
       .attr("width", x)
       .attr("height", bar_height)

    var loadings = svg.selectAll("loadings")
       .data(feature_loadings)
       .enter().append("text")
       .attr("x", function(d) { return x(d) + left_width; })
       .attr("y", function(d){ return y(d) + y.rangeBand()/2; })
       .attr("dx", 70)
       .attr("dy", ".36em")
       .attr("text-anchor", "end")
       .attr('class', 'loadings')
       .text(String);

    var names = svg.selectAll("names")
       .data(feature_names)
       .enter().append("text")
       .attr("x", 0)
       .attr("y", function(d){ return y2(d) + y.rangeBand()/2; } )
       .attr("dy", ".36em")
       .attr("text-anchor", "start")
       .attr('class', 'names')
       .text(String);

    svg.append("text")
        .attr("class", "chart_name")
        .attr("text-anchor", "middle")
        .attr("transform", "translate(370,540)")
        .text("Squared loadings of all the features");

}


function calculate_pca() {

    var obj_array = [];
    var min = 0, max = 0;
    var feature_names = Object.keys(pcaData);
    for(var i=0; i < Object.keys(pcaData[0]).length; ++i){
        obj = {}
        obj.x = pcaData[0][i];
        obj.y = pcaData[1][i];

        obj.clusterid = pcaData['clusterid'][i]
        obj.col1 = pcaData[feature_names[2]][i]
        obj.col2 = pcaData[feature_names[3]][i]
        obj_array.push(obj);
    }

    pcaData = obj_array;

    var width = 650;
    var height = 700;
    var chart_width = 600;
    var chart_height = 450;

    var xValue = function(d) { return d.x;};
    var xScale = d3.scale.linear().range([0, chart_width - 30]);
    var xMap = function(d) { return xScale(xValue(d)); };
    var xAxis = d3.svg.axis().scale(xScale).orient("bottom");

    var yValue = function(d) { return d.y;};
    var yScale = d3.scale.linear().range([chart_height, 0]);
    var yMap = function(d) { return yScale(yValue(d));};
    var yAxis = d3.svg.axis().scale(yScale).orient("left");

    var cluster_color = function(d) { return d.clusterid;}
    var color = d3.scale.category10();

    var svg = d3.select("#pca_plot");

    var tooltip = d3.select("body").append('div').style('position','absolute');

    xScale.domain([d3.min(pcaData, xValue)-1, d3.max(pcaData, xValue)+1]);
    yScale.domain([d3.min(pcaData, yValue)-0.2, d3.max(pcaData, yValue)+0.2]);

    xAxisLine = svg.append("g")
          .attr("transform", "translate(60," + (chart_height) + ")")
          .attr("class", "x_axis")
          .call(xAxis)

    yAxisLine = svg.append("g")
          .attr("transform", "translate(60,0)")
          .attr("class", "y_axis")
          .call(yAxis)

    svg.append("text")
            .attr("class", "axis_label")
            .attr("text-anchor", "middle")
            .attr("transform", "translate("+ 10 +","+(chart_height/2)+")rotate(-90)")
            .text(feature_names[2]);

    svg.append("text")
        .attr("class", "axis_label")
        .attr("text-anchor", "middle")
        .attr("transform", "translate("+ (height/2) +","+ (chart_height + 40)+")")
        .text(feature_names[3]);

    svg.append("text")
        .attr("class", "chart_name")
        .attr("text-anchor", "middle")
        .attr("transform", "translate("+ (height/2) +","+ 535 +")")
        .text("PCA plot");

    svg.selectAll(".dot")
          .data(pcaData)
          .enter().append("circle")
          .attr("class", "dot")
          .attr("cx", xMap)
          .attr("r", 3.5)
          .attr("cy", yMap)
          .style("fill", function(d) { return color(cluster_color(d));})
          .on("mouseover", function(d) {
              tooltip.transition()
                .style('opacity', .9)
                .style('font-family', fontFamily)
                .style('color','black')
                .style('font-size', '12px')
              tooltip.html(feature_names[2] + ":" + d.col1 + ", " + feature_names[3] + ":" + d.col2)
                .style("top", (d3.event.pageY - 28) + "px")
                .style("left", (d3.event.pageX + 5) + "px");
          })
          .on("mouseout", function(d) {
              tooltip.transition()
                .duration(500)
                .style("opacity", 0);
              tooltip.html('');
          });
}

function calculate_mds() {

    var obj_array = [];
    var min = 0, max = 0;
    var feature_names = Object.keys(mdsData);

    for(var i=0; i < Object.keys(mdsData[0]).length; ++i){
        obj = {}
        obj.x = mdsData[0][i];
        obj.y = mdsData[1][i];

        obj.clusterid = mdsData['clusterid'][i]
        obj.col1 = mdsData[feature_names[2]][i]
        obj.col2 = mdsData[feature_names[3]][i]
        obj_array.push(obj);
    }

    mdsData = obj_array;

    var width = 650;
    var height = 700;

    var chart_width = 600;
    var chart_height = 450;

    var xValue = function(d) { return d.x;};
    var xScale = d3.scale.linear().range([0, chart_width - 30]);
    var xMap = function(d) { return xScale(xValue(d)); };
    var xAxis = d3.svg.axis().scale(xScale).orient("bottom");

    var yValue = function(d) { return d.y;};
    var yScale = d3.scale.linear().range([chart_height, 0]);
    var yMap = function(d) { return yScale(yValue(d));};
    var yAxis = d3.svg.axis().scale(yScale).orient("left");

    var cluster_color = function(d) { return d.clusterid;}
    var color = d3.scale.category10();

    var svg = d3.select("#mds_plot");

    var tooltip = d3.select("body").append('div').style('position','absolute');

    xScale.domain([d3.min(mdsData, xValue)-1, d3.max(mdsData, xValue)+1]);
    yScale.domain([d3.min(mdsData, yValue)-0.2, d3.max(mdsData, yValue)+0.2]);

    xAxisLine = svg.append("g")
          .attr("transform", "translate(60," + (chart_height) + ")")
          .attr("class", "x_axis")
          .call(xAxis)

    yAxisLine = svg.append("g")
          .attr("transform", "translate(60,0)")
          .attr("class", "y_axis")
          .call(yAxis)

    svg.append("text")
            .attr("class", "axis_label")
            .attr("text-anchor", "middle")
            .attr("transform", "translate("+ 10 +","+(chart_height/2)+")rotate(-90)")
            .text(feature_names[2]);

    svg.append("text")
        .attr("class", "axis_label")
        .attr("text-anchor", "middle")
        .attr("transform", "translate("+ (height/2) +","+ (chart_height + 40)+")")
        .text(feature_names[3]);

    svg.append("text")
        .attr("class", "chart_name")
        .attr("text-anchor", "middle")
        .attr("transform", "translate("+ (height/2) +","+ 535 +")")
        .text("MDS plot");

    svg.selectAll(".dot")
          .data(mdsData)
          .enter().append("circle")
          .attr("class", "dot")
          .attr("cx", xMap)
          .attr("r", 3.5)
          .attr("cy", yMap)
          .style("fill", function(d) { return color(cluster_color(d));})
          .on("mouseover", function(d) {
              tooltip.transition()
                .style('opacity', .9)
                .style('font-family', fontFamily)
                .style('color','black')
                .style('font-size', '12px')
              tooltip.html(feature_names[2] + ":" + d.col1 + ", " + feature_names[3] + ":" + d.col2)
                .style("top", (d3.event.pageY - 28) + "px")
                .style("left", (d3.event.pageX + 5) + "px");
          })
          .on("mouseout", function(d) {
              tooltip.transition()
                .duration(500)
                .style("opacity", 0);
              tooltip.html('');
          });
}

function openTabClick(evt, container, index) {

    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(container).style.display = "block";
    evt.currentTarget.className += " active";
}