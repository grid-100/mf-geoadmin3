goog.provide('ga_print_directive');

goog.require('ga_attribution_service');
goog.require('ga_browsersniffer_service');
goog.require('ga_print_style_service');
goog.require('ga_time_service');

(function() {

  var module = angular.module('ga_print_directive', [
    'ga_browsersniffer_service',
    'pascalprecht.translate',
    'ga_print_style_service',
    'ga_time_service',
    'ga_attribution_service'
  ]);

  module.controller('GaPrintDirectiveController', function($rootScope, $scope,
      $http, $q, $window, $translate, $timeout, gaLayers, gaMapUtils, 
      gaPermalink, gaBrowserSniffer, gaWaitCursor, gaPrintStyleService,
      gaTime, gaAttribution) {

    var pdfLegendsToDownload = [];
    var pdfLegendString = '_big.pdf';
    var printRectangle;
    var deregister = [];
    var POINTS_PER_INCH = 72; //PostScript points 1/72"
    var MM_PER_INCHES = 25.4;
    var UNITS_RATIO = 39.37; // inches per meter
    var POLL_INTERVAL = 2000; //interval for multi-page prints (ms)
    var POLL_MAX_TIME = 600000; //ms (10 minutes)
    var layersYears = [];
    var canceller;
    var currentMultiPrintId;
    var format = new ol.format.GeoJSON();
    var styleId = 0;
    $scope.printConfigLoaded = false;
    $scope.options.multiprint = false;
    $scope.options.movie = false;
    $scope.options.printing = false;
    $scope.options.printsuccess = false;
    $scope.options.progress = '';

    // Get print config
    var loadPrintConfig = function() {
      window.console.log('FUNCTION 1: GET PRINT CONFIG');
      canceller = $q.defer();
      var http = $http.get($scope.options.printConfigUrl, {
        timeout: canceller.promise
      });
      window.console.log('$scope.options');
      window.console.log($scope.options);
      window.console.log('$scope.options.printConfigUrl');
      window.console.log($scope.options.printConfigUrl);
      window.console.log('http');
      window.console.log(http);
      return http;
    };

    var activate = function() {
      window.console.log('FUNCTION 2: ACTIVATE');
      deregister = [
        $scope.map.on('precompose', handlePreCompose),
        $scope.map.on('postcompose', handlePostCompose),
        $scope.map.on('change:size', function(event) {
          updatePrintRectanglePixels($scope.scale);
        }),
        $scope.map.getView().on('propertychange', function(event) {
          updatePrintRectanglePixels($scope.scale);
        }),
        $scope.$watchGroup(['scale', 'layout'], function() {
          updatePrintRectanglePixels($scope.scale);
        })
      ];
      window.console.log('ACTIVATE FUNCTION: $scope.scale before function getOptimal ' + $scope.scale);
      $scope.scale = getOptimalScale();
      window.console.log('ACTIVATE FUNCTION: $scope.scale after getOptimal  ' + $scope.scale);
      refreshComp();

    };
    var deactivate = function() {
      window.console.log('FUNCTION 3: DEACTIVATE');
      var item;
      while (item = deregister.pop()) {
        if (angular.isFunction(item)) {
          item();
        } else {
          ol.Observable.unByKey(item);
        }
      }
      refreshComp();
    };

    var refreshComp = function() {
      window.console.log('FUNCTION 4: REFRESHCOMP');
      updatePrintRectanglePixels($scope.scale);
      $scope.map.render();
    };

    // Compose events
    var handlePreCompose = function(evt) {
      window.console.log('FUNCTION 5: HANDLEPRECOMPOSE');
      var ctx = evt.context;
      ctx.save();
    };

    var handlePostCompose = function(evt) {
      window.console.log('FUNCTION 6: HANDLEPOSTPROCOMPOSE');
      var ctx = evt.context,
          size = $scope.map.getSize(),
          minx = printRectangle[0],
          miny = printRectangle[1],
          maxx = printRectangle[2],
          maxy = printRectangle[3];

      var height = size[1] * ol.has.DEVICE_PIXEL_RATIO,
          width = size[0] * ol.has.DEVICE_PIXEL_RATIO;

      ctx.beginPath();
      // Outside polygon, must be clockwise
      ctx.moveTo(0, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.lineTo(0, 0);
      ctx.closePath();

      // Inner polygon,must be counter-clockwise
      ctx.moveTo(minx, miny);
      ctx.lineTo(minx, maxy);
      ctx.lineTo(maxx, maxy);
      ctx.lineTo(maxx, miny);
      ctx.lineTo(minx, miny);
      ctx.closePath();

      ctx.fillStyle = 'rgba(0, 5, 25, 0.75)';
      ctx.fill();

      ctx.restore();
    };

    // Encode ol.Layer to a basic js object
    var encodeLayer = function(layer, proj) {
      window.console.log('FUNCTION 7: ENCODE LAYER');
      var encLayer, encLegend;

      if (!(layer instanceof ol.layer.Group)) {
        var src = layer.getSource();
        var layerConfig = gaLayers.getLayer(layer.bodId) || {};
        var resolution = $scope.map.getView().getResolution();
        var minResolution = layerConfig.minResolution || 0;
        var maxResolution = layerConfig.maxResolution || Infinity;

        if (resolution <= maxResolution &&
            resolution >= minResolution) {
          if (src instanceof ol.source.WMTS) {
            encLayer = $scope.encoders.layers['WMTS'].call(this,
                layer, layerConfig);
          } else if (src instanceof ol.source.ImageWMS ||
              src instanceof ol.source.TileWMS) {
            encLayer = $scope.encoders.layers['WMS'].call(this,
                layer, layerConfig);
          } else if (src instanceof ol.source.Vector ||
              src instanceof ol.source.ImageVector) {
            if (src instanceof ol.source.ImageVector) {
              src = src.getSource();
            }
            var features = [];
            var extent = getPrintRectangleCoords();
            src.forEachFeatureInExtent(extent, function(feat) {
              features.push(feat);
            });

            if (features && features.length > 0) {
              encLayer = $scope.encoders.layers['Vector'].call(this, layer,
                  features);
            }
          }
        }
      }

      if ($scope.options.legend && layerConfig.hasLegend) {
        encLegend = $scope.encoders.legends['ga_urllegend'].call(this,
            layer, layerConfig);

        if (encLegend.classes &&
            encLegend.classes[0] &&
            encLegend.classes[0].icon) {
          var legStr = encLegend.classes[0].icon;
          if (legStr.indexOf(pdfLegendString,
              legStr.length - pdfLegendString.length) !== -1) {
            pdfLegendsToDownload.push(legStr);
            encLegend = undefined;
          }
        }
      }
      return {layer: encLayer, legend: encLegend};
    };

    // Transform an ol.Color to an hexadecimal string
    var toHexa = function(olColor) {
      window.console.log('FUNCTION 8: TO HEXA');
      var hex = '#';
      for (var i = 0; i < 3; i++) {
        var part = olColor[i].toString(16);
        if (part.length === 1 && parseInt(part) < 10) {
          hex += '0';
        }
        hex += part;
      }
      return hex;
    };

    // Transform a ol.style.Style to a print literal object
    var transformToPrintLiteral = function(feature, style) {
      window.console.log('FUNCTION 9: TRANSFORM TO PRINTLITERAL');
      /**
       * ol.style.Style properties:
       *
       *  fill: ol.style.Fill :
       *    fill: String
       *  image: ol.style.Image:
       *    anchor: array[2]
       *    rotation
       *    size: array[2]
       *    src: String
       *  stroke: ol.style.Stroke:
       *    color: String
       *    lineCap
       *    lineDash
       *    lineJoin
       *    miterLimit
       *    width: Number
       *  text
       *  zIndex
       */

      /**
       * Print server properties:
       *
       * fillColor
       * fillOpacity
       * strokeColor
       * strokeOpacity
       * strokeWidth
       * strokeLinecap
       * strokeLinejoin
       * strokeDashstyle
       * pointRadius
       * label
       * fontFamily
       * fontSize
       * fontWeight
       * fontColor
       * labelAlign
       * labelXOffset
       * labelYOffset
       * labelOutlineColor
       * labelOutlineWidth
       * graphicHeight
       * graphicOpacity
       * graphicWidth
       * graphicXOffset
       * graphicYOffset
       * zIndex
       */

      var literal = {
        zIndex: style.getZIndex()
      };
      var type = feature.getGeometry().getType();
      var fill = style.getFill();
      var stroke = style.getStroke();
      var textStyle = style.getText();
      var imageStyle = style.getImage();

      if (imageStyle) {
        var size, anchor, scale = imageStyle.getScale();
        literal.rotation = imageStyle.getRotation();

        if (imageStyle instanceof ol.style.Icon) {
          size = imageStyle.getSize();
          anchor = imageStyle.getAnchor();
          literal.externalGraphic = imageStyle.getSrc();
          literal.fillOpacity = 1;
        } else if (imageStyle instanceof ol.style.Circle) {
          fill = imageStyle.getFill();
          stroke = imageStyle.getStroke();
          var radius = imageStyle.getRadius();
          var width = 2 * radius;
          if (stroke) {
            width += stroke.getWidth() + 1;
          }
          size = [width, width];
          anchor = [width / 2, width / 2];
          literal.pointRadius = radius;
        }

        if (size) {
          // Print server doesn't handle correctly 0 values for the size
          literal.graphicWidth = (size[0] * scale || 0.1);
          literal.graphicHeight = (size[1] * scale || 0.1);
        }
        if (anchor) {
          literal.graphicXOffset = -anchor[0] * scale;
          literal.graphicYOffset = -anchor[1] * scale;
        }

      }

      if (fill) {
        var color = ol.color.asArray(fill.getColor());
        literal.fillColor = toHexa(color);
        literal.fillOpacity = color[3];
      } else if (!literal.fillOpacity) {
        literal.fillOpacity = 0; // No fill
      }

      if (stroke) {
        var color = ol.color.asArray(stroke.getColor());
        literal.strokeWidth = stroke.getWidth();
        literal.strokeColor = toHexa(color);
        literal.strokeOpacity = color[3];
        literal.strokeLinecap = stroke.getLineCap() || 'round';
        literal.strokeLinejoin = stroke.getLineJoin() || 'round';

        if (stroke.getLineDash()) {
          literal.strokeDashstyle = 'dash';
        }
        // TO FIX: Not managed by the print server
        // literal.strokeMiterlimit = stroke.getMiterLimit();
      } else {
        literal.strokeOpacity = 0; // No Stroke
      }

      if (textStyle && textStyle.getText()) {
        literal.label = textStyle.getText();
        literal.labelAlign = textStyle.getTextAlign();

        if (textStyle.getFill()) {
          var fillColor = ol.color.asArray(textStyle.getFill().getColor());
          literal.fontColor = toHexa(fillColor);
        }

        if (textStyle.getFont()) {
          var fontValues = textStyle.getFont().split(' ');
          // Fonts managed by print server: COURIER, HELVETICA, TIMES_ROMAN
          literal.fontFamily = fontValues[2].toUpperCase();
          literal.fontSize = parseInt(fontValues[1]);
          literal.fontWeight = fontValues[0];
        }

        /* TO FIX: Not managed by the print server
        if (textStyle.getStroke()) {
          var strokeColor = ol.color.asArray(textStyle.getStroke().getColor());
          literal.labelOutlineColor = toHexa(strokeColor);
          literal.labelOutlineWidth = textStyle.getStroke().getWidth();
        }*/
      }

      return literal;
    };

    // Encoders by type of layer
    $scope.encoders = {
      'layers': {
        'Layer': function(layer) {
          var enc = {
            layer: layer.bodId,
            opacity: layer.getOpacity()
          };
          window.console.log('enc');
          window.console.log('------------------------');
          window.console.log(enc);          
          return enc;
        },
        'Group': function(layer, proj) {
          var encs = [];
          var subLayers = layer.getLayers();
          subLayers.forEach(function(subLayer, idx, arr) {
            if (subLayer.visible) {
              var enc = $scope.encoders.
                  layers['Layer'].call(this, layer);
              var layerEnc = encodeLayer(subLayer, proj);
              if (layerEnc && layerEnc.layer) {
                $.extend(enc, layerEnc);
                encs.push(enc.layer);
              }
            }
          });
          window.console.log('encs');
          window.console.log('------------------------');
          window.console.log(encs);          
          return encs;
        },
        'Vector': function(layer, features) {
          var enc = $scope.encoders.
              layers['Layer'].call(this, layer);
          var encStyles = {};
          var encFeatures = [];
          var stylesDict = {};

          // Sort features by geometry type
          var newFeatures = [];
          var polygons = [];
          var lines = [];
          var points = [];

          angular.forEach(features, function(feature) {
            var geotype = feature.getGeometry().getType();
            if (/^(Polygon|MultiPolygon|Circle|GeometryCollection)$/.
                test(geotype)) {
              polygons.push(feature);
            } else if (/^(LineString|MultiLineString)$/.test(geotype)) {
              lines.push(feature);
            } else {
              points.push(feature);
            }
          });
          features = newFeatures.concat(polygons, lines, points);

          angular.forEach(features, function(feature) {
            var encoded = $scope.encoders.features.feature(layer, feature);
            encFeatures = encFeatures.concat(encoded.encFeatures);
            angular.extend(encStyles, encoded.encStyles);
          });
          angular.extend(enc, {
            type: 'Vector',
            styles: encStyles,
            styleProperty: '_gx_style',
            geoJson: {
              type: 'FeatureCollection',
              features: encFeatures
            },
            name: layer.bodId,
            opacity: (layer.opacity != null) ? layer.opacity : 1.0
          });
          window.console.log('encVector');
          window.console.log('------------------------');
          window.console.log(enc);          

          return enc;
        },
        'WMS': function(layer, config) {
            var enc = $scope.encoders.
              layers['Layer'].call(this, layer);
            var params = layer.getSource().getParams();
            var layers = params.LAYERS.split(',') || [];
            var styles = (params.STYLES !== undefined) ?
                params.STYLES.split(',') :
                new Array(layers.length).join(',').split(',');
            angular.extend(enc, {
              type: 'WMS',
              baseURL: config.wmsUrl || layer.url,
              layers: layers,
              styles: styles,
              imageFormat: 'image/' + (config.format || 'png'),
              customParams: {
                'EXCEPTIONS': 'XML',
                'TRANSPARENT': 'true',
                'CRS': 'EPSG:21781',
                'TIME': params.TIME
              },
              singleTile: config.singleTile || false
            });
          window.console.log('encWMS');
          window.console.log('------------------------');
          window.console.log(enc);          
          return enc;

        },
        'WMTS': function(layer, config) {
            var enc = $scope.encoders.layers['Layer'].
                call(this, layer);
            var source = layer.getSource();
            var tileGrid = source.getTileGrid();
            if (!config.background && layer.visible && config.timeEnabled) {
              layersYears.push(layer.time);
            }
            angular.extend(enc, {
              type: 'WMTS',
              baseURL: location.protocol + '//wmts.geo.admin.ch',
              layer: config.serverLayerName,
              //maxExtent: layer.getExtent(),
              //tileOrigin: tileGrid.getOrigin(),
              //tileSize: [tileGrid.getTileSize(), tileGrid.getTileSize()],
              //resolutions: tileGrid.getResolutions(),
              //zoomOffset: tileGrid.getMinZoom(),
              requestEncoding: 'REST',
              version: '1.0.0',
              style: 'default',
              imageFormat: config.format || 'jpeg',
              dimensions: ['TIME'],
              dimensionParams: {'TIME': source.getDimensions().Time},
              matrixSet: '21781',
              matrices: [{
                identifier: tileGrid.matrixIds_,
                tileSize: [tileGrid.getTileSize(), tileGrid.getTileSize()],
                topLeftCorner: tileGrid.origin,
                matrixSize: [1, 1]
               }] 
          });
          var multiPagesPrint = false;
          if (config.timestamps) {
            multiPagesPrint = !config.timestamps.some(function(ts) {
              return ts == '99991231';
            });
          }
          // printing time series
          if (config.timeEnabled && gaTime.get() == undefined &&
              multiPagesPrint) {
            enc['timestamps'] = config.timestamps;
          }
          window.console.log('config');
          window.console.log(config);
          window.console.log('layer');
          window.console.log(layer);
          window.console.log('source');
          window.console.log(source);
          window.console.log('tileGrid');
          window.console.log(tileGrid);
          window.console.log('encWMTS');
          window.console.log('------------------------');
          window.console.log(enc);          
          return enc;
        }
      },
      'features': {
        'feature': function(layer, feature, styles) {
          var encStyles = {};
          var encFeatures = [];
          var encStyle = {
            id: styleId++
          };

          // Get the styles of the feature
          if (!styles) {
            if (feature.getStyleFunction()) {
              styles = feature.getStyleFunction().call(feature);
            } else if (layer.getStyleFunction()) {
              styles = layer.getStyleFunction()(feature);
            } else {
              styles = ol.style.defaultStyleFunction(feature);
            }
          }

          // Transform an ol.geom.Circle to a ol.geom.Polygon
          var geometry = feature.getGeometry();
          if (geometry instanceof ol.geom.Circle) {
            var polygon = gaPrintStyleService.olCircleToPolygon(geometry);
            feature = new ol.Feature(polygon);
          }

          // Handle ol.style.RegularShape by converting points to poylgons
          var image = styles[0].getImage();
          if (image instanceof ol.style.RegularShape) {
            var scale = parseFloat($scope.scale.value);
            window.console.log('scale in image style');
            window.console.log(scale);
            var resolution = scale / UNITS_RATIO / POINTS_PER_INCH;
            feature = gaPrintStyleService.olPointToPolygon(
                styles[0], feature, resolution);
          }

          // Encode a feature
          var encFeature = format.writeFeatureObject(feature);
          if (!encFeature.properties) {
            encFeature.properties = {};
         } else {
           // Fix circular structure to JSON
           // see: https://github.com/geoadmin/mf-geoadmin3/issues/1213
            delete encFeature.properties.Style;
            delete encFeature.properties.overlays;
          }
          encFeature.properties._gx_style = encStyle.id;
          encFeatures.push(encFeature);

          // Encode a style of a feature
                   if (styles && styles.length > 0) {
            angular.extend(encStyle, transformToPrintLiteral(feature,
                styles[0]));
            encStyles[encStyle.id] = encStyle;
            var styleToEncode = styles[0];
            // If a feature has a style with a geometryFunction defined, we
            // must also display this geometry with the good style (used for
            // azimuth).
            for (var i = 0; i < styles.length; i++) {
              var style = styles[i];
              if (angular.isFunction(style.getGeometry())) {
                var geom = style.getGeometry()(feature);
                if (geom) {
                  var encoded = $scope.encoders.features.feature(layer,
                      new ol.Feature(geom), [style]);
                  encFeatures = encFeatures.concat(encoded.encFeatures);
                  angular.extend(encStyles, encoded.encStyles);
                }
              }
            }
          }

          window.console.log('encFeatures');
          window.console.log(encFeatures);
          window.console.log('encStyles');
          window.console.log(encStyles);
          return {
            encFeatures: encFeatures,
            encStyles: encStyles
          };
        }
      },
      'legends' : {
        'ga_urllegend': function(layer, config) {
          var format = '.png';
          if ($scope.options.pdfLegendList.indexOf(layer.bodId) != -1) {
            format = pdfLegendString;
          }
          var enc = $scope.encoders.legends.base.call(this, config);
          enc.classes.push({
            name: '',
            icon: $scope.options.legendUrl +
                layer.bodId + '_' + $translate.use() + format
          });
          return enc;
        },
        'base': function(config) {
          return {
            name: config.label,
            classes: []
          };
        }
      }
    };

    var getZoomFromScale = function(scale) {
      window.console.log('FUNCTION 10: GET ZOOM FROM SCALE');
      var i, len;
      var resolution = scale / UNITS_RATIO / POINTS_PER_INCH;
      var resolutions = gaMapUtils.viewResolutions;
      for (i = 0, len = resolutions.length; i < len; i++) {
        if (resolutions[i] < resolution) {
          break;
        }
      }
      var zoom = Math.max(0, i - 1);

      return zoom;
    };

    var getNearestScale = function(target, scales) {
      window.console.log('FUNCTION 11: GET NEARESR SCALE');
      var nearest = null;
      angular.forEach(scales, function(scale) {
        if (nearest == null ||
            Math.abs(scale - target) < Math.abs(nearest - target)) {
              nearest = scale;
        }
      });
      return nearest;
    };

    $scope.downloadUrl = function(url) {
      $scope.options.printsuccess = true;
      window.console.log('$SCOPE: $scope.downloadUrl');
      if (gaBrowserSniffer.msie == 9) {
        $window.open(url);
      } else {
        $window.location = url;
      }
      //After standard print, download the pdf Legends
      //if there are any
      for (var i = 0; i < pdfLegendsToDownload.length; i++) {
        $window.open(pdfLegendsToDownload[i]);
      }
      $scope.options.printing = false;
    };

    // Abort the print process
    var pollMultiPromise; // Promise of the last $timeout called
    $scope.abort = function() {
      window.console.log('$SCOPE: $scope.abort');
      $scope.options.printing = false;
      // Abort the current $http request
      if (canceller) {
        canceller.resolve();
      }
      // Abort the current $timeout
      if (pollMultiPromise) {
        $timeout.cancel(pollMultiPromise);
      }
      // Tell the server to cancel the print process
      if (currentMultiPrintId) {
        $http.get($scope.options.printPath + 'cancel?id=' +
          currentMultiPrintId);
        currentMultiPrintId = null;
      }
    };

    // Start the print process
    $scope.submit = function() {
      window.console.log('$SCOPE: $scope.submit');
      window.console.log('****************************************');
      window.console.log('****************************************');
      if (!$scope.active) {
        return;
      }
      $scope.options.printsuccess = false;
      $scope.options.printing = true;
      $scope.options.progress = '';
      // http://mapfish.org/doc/print/protocol.html#print-pdf
      var view = $scope.map.getView();
      var proj = view.getProjection();
      var lang = $translate.use();
      window.console.log('view ');
      window.console.log(view);
      window.console.log('proj ');
      window.console.log(proj);
      window.console.log('lang ' + lang);
      var defaultPage = {};
      defaultPage['lang' + lang] = true;
      var qrcodeUrl = $scope.options.qrcodeUrl +
          encodeURIComponent(gaPermalink.getHref());
      var print_zoom = getZoomFromScale($scope.scale); //edw epaize scope.value
      window.console.log('print_zoom');
      window.console.log(print_zoom);
      qrcodeUrl = qrcodeUrl.replace(/zoom%3D(\d{1,2})/, 'zoom%3D' + print_zoom);
      window.console.log('qrcodeUrl');
      window.console.log(qrcodeUrl);
      var encLayers = [];
      var encLegends;
      var attributions = [];
      var thirdPartyAttributions = [];
      var layers = this.map.getLayers().getArray();
      pdfLegendsToDownload = [];
      layersYears = [];

      // Re order layer by z-index
      layers.sort(function(a, b) {
        return a.getZIndex() - b.getZIndex();
      });

      // Transform layers to literal
      layers.forEach(function(layer) {
        if (layer.visible && (!layer.timeEnabled ||
            angular.isDefined(layer.time))) {

          // Get all attributions to diaplay
          var attribution = gaAttribution.getTextFromLayer(layer);
          if (attribution !== undefined) {
            if (layer.useThirdPartyData) {
              if (thirdPartyAttributions.indexOf(attribution) == -1) {
                thirdPartyAttributions.push(attribution);
              }
            } else if (attributions.indexOf(attribution) == -1) {
              attributions.push(attribution);
            }
          }

          // Encode layers
          if (layer instanceof ol.layer.Group) {
            var encs = $scope.encoders.layers['Group'].call(this,
                layer, proj);
            encLayers = encLayers.concat(encs);
          } else {
            var enc = encodeLayer(layer, proj);
            if (enc && enc.layer) {
              encLayers.push(enc.layer);
              if (enc.legend) {
                encLegends = encLegends || [];
                encLegends.push(enc.legend);
              }
            }
          }
        }
      });
      if (layersYears) {
        var years = layersYears.reduce(function(a, b) {
          if (a.indexOf(b) < 0) {
            a.push(b);
          }
          return a;
        }, []);
        years = years.map(function(ts) {
          return ts.length > 4 ? ts.slice(0, 4) : ts;
        });
        defaultPage['timestamp'] = years.join(',');
      }

      // Transform graticule to literal
      if ($scope.options.graticule) {
        var graticule = {
          'baseURL': 'https://wms.geo.admin.ch/',
          'opacity': 1,
          'singleTile': true,
          'type': 'WMS',
          'layers': ['org.epsg.grid_21781,org.epsg.grid_4326'],
          'format': 'image/png',
          'styles': [''],
          'customParams': {
            'TRANSPARENT': true
          }
        };
        encLayers.push(graticule);
      }

      // Transform overlays to literal
      // FIXME this is a temporary solution
      var overlays = $scope.map.getOverlays();
      var resolution = $scope.map.getView().getResolution();

      overlays.forEach(function(overlay) {
        var elt = overlay.getElement();
        // We print only overlay added by the MarkerOverlayService
        // or by crosshair permalink
        if ($(elt).hasClass('popover')) {
          return;
        }
        var center = overlay.getPosition();
        var offset = 5 * resolution;

        if (center) {
          var encOverlayLayer = {
            'type': 'Vector',
            'styles': {
              '1': { // Style for marker position
                'externalGraphic': $scope.options.markerUrl,
                'graphicWidth': 20,
                'graphicHeight': 30,
                // the icon is not perfectly centered in the image
                // these values must be the same in map.less
                'graphicXOffset': -12,
                'graphicYOffset': -30
              }, '2': { // Style for measure tooltip
                'externalGraphic': $scope.options.bubbleUrl,
                'graphicWidth': 97,
                'graphicHeight': 27,
                'graphicXOffset': -48,
                'graphicYOffset': -27,
                'label': $(elt).text(),
                'labelXOffset': 0,
                'labelYOffset': 18,
                'fontColor': '#ffffff',
                'fontSize': 10,
                'fontWeight': 'normal'
              }
            },
            'styleProperty': '_gx_style',
            'geoJson': {
              'type': 'FeatureCollection',
              'features': [{
                'type': 'Feature',
                'properties': {
                  '_gx_style': ($(elt).text() ? 2 : 1)
                },
                'geometry': {
                  'type': 'Point',
                  'coordinates': [center[0], center[1], 0]
                }
              }]
            },
            'name': 'drawing',
            'opacity': 1
          };
          encLayers.push(encOverlayLayer);
        }
      });


      // Get the short link
      var shortLink;
      canceller = $q.defer();
      var promise = $http.get($scope.options.shortenUrl, {
        timeout: canceller.promise,
        params: {
          url: gaPermalink.getHref()
        }
      }).success(function(response) {
        shortLink = response.shorturl.replace('/shorten', '');
      });

      // Build the complete json then send it to the print server
      promise.then(function() {
        if (!$scope.options.printing) {
          return;
        }

        // Build the correct copyright text to display
        var dataOwner = attributions.join();
        var thirdPartyDataOwner = thirdPartyAttributions.join();
        if (dataOwner && thirdPartyDataOwner) {
          dataOwner = '© ' + dataOwner + ',';
        } else if (!dataOwner && thirdPartyDataOwner) {
          thirdPartyDataOwner = '© ' + thirdPartyDataOwner;
        } else if (dataOwner && !thirdPartyDataOwner) {
          dataOwner = '© ' + dataOwner;
          thirdPartyDataOwner = false;
        }
        var movieprint = $scope.options.movie && $scope.options.multiprint;
        var spec = {
          layout: $scope.layout.name,
          srs: proj.getCode(),
          units: proj.getUnits() || 'm',
          rotation: -((view.getRotation() * 180.0) / Math.PI),
          app: 'config',
          lang: lang,
          //use a function to get correct dpi according to layout (A4/A3)
          dpi: getDpi($scope.layout.name, $scope.dpi),
          layers: encLayers,
          legends: encLegends,
          enableLegends: (encLegends && encLegends.length > 0),
          qrcodeurl: qrcodeUrl,
          movie: movieprint,
          pages: [
            angular.extend({
              center: getPrintRectangleCenterCoord(),
              bbox: getPrintRectangleCoords(),
              display: [$scope.layout.map.width, $scope.layout.map.height],
              // scale has to be one of the advertise by the print server
              scale: $scope.scale.value,
              dataOwner: dataOwner,
              thirdPartyDataOwner: thirdPartyDataOwner,
              shortLink: shortLink || '',
              rotation: -((view.getRotation() * 180.0) / Math.PI)
            }, defaultPage)
          ]
        };
        var startPollTime;
        var pollErrors;
        var pollMulti = function(url) {
          pollMultiPromise = $timeout(function() {
            if (!$scope.options.printing) {
              return;
            }
            canceller = $q.defer();
            var http = $http.get(url, {
               timeout: canceller.promise
            }).success(function(data) {
              if (!$scope.options.printing) {
                return;
              }
              if (!data.getURL) {
                // Write progress using the following logic
                // First 60% is pdf page creationg
                // 60-70% is merging of pdf
                // 70-100% is writing of resulting pdf
                if (data.filesize) {
                  var written = data.written || 0;
                  $scope.options.progress =
                      (70 + Math.floor(written * 30 / data.filesize)) +
                      '%';
                } else if (data.total) {
                  if (angular.isDefined(data.merged)) {
                    $scope.options.progress =
                        (60 + Math.floor(data.done * 10 / data.total)) +
                        '%';
                  } else if (angular.isDefined(data.done)) {
                    $scope.options.progress =
                        Math.floor(data.done * 60 / data.total) + '%';
                  }
                }

                var now = new Date();
                //We abort if we waited too long
                if (now - startPollTime < POLL_MAX_TIME) {
                  pollMulti(url);
                } else {
                  $scope.options.printing = false;
                }
              } else {
                $scope.downloadUrl(data.getURL);
              }
            }).error(function() {
              if ($scope.options.printing == false) {
                pollErrors = 0;
                return;
              }
              pollErrors += 1;
              if (pollErrors > 2) {
                $scope.options.printing = false;
              } else {
                pollMulti(url);
              }
            });
          }, POLL_INTERVAL, false);
        };

        var printUrl = $scope.options.createURL;
        window.console.log('printUrl');
        window.console.log('***************************');
        window.console.log(printUrl);
        window.console.log('$scope.options.printing');
        window.console.log($scope.options.printing);

        //When movie is on, we use printmulti
        if (movieprint) {
          printUrl = printUrl.replace('/print/', '/printmulti/');//afterwards have to take a look here!
        }
        canceller = $q.defer();
        var http = $http.post(printUrl,
          spec, {
          timeout: canceller.promise
        }).success(function(data) {
          if (movieprint) {
            //start polling process
            var pollUrl = $scope.options.printPath + 'progress?id=' +
                data.idToCheck;
            currentMultiPrintId = data.idToCheck;
            startPollTime = new Date();
            pollErrors = 0;
            pollMulti(pollUrl);
          } else {
            $scope.downloadUrl(data.getURL);
          }
        }).error(function() {
          $scope.options.printing = false;
        });

        window.console.log('http');
        window.console.log(http);
        //window.console.log('$scope.downloadUrl');
        //window.console.log($scope.downloadUrl(http));

      });
    };

    var getDpi = function(layoutName, dpiConfig) {
      window.console.log('FUNCTION 12: GET DPI');
      if (/a4/i.test(layoutName) && dpiConfig.length > 1) {
        return dpiConfig[1].value;
      } else {
        return dpiConfig[0].value;
      }
    };

    var getPrintRectangleCoords = function() {
      window.console.log('FUNCTION 13: GET PRINT RECTANGLE COORDS');
      // Framebuffer size!!
      var displayCoords = printRectangle.map(function(c) {
          return c / ol.has.DEVICE_PIXEL_RATIO});
      // PrintRectangle coordinates have top-left as origin
      var bottomLeft = $scope.map.getCoordinateFromPixel([displayCoords[0],
          displayCoords[3]]);
      var topRight = $scope.map.getCoordinateFromPixel([displayCoords[2],
          displayCoords[1]]);
      return bottomLeft.concat(topRight);
    };

    var getPrintRectangleCenterCoord = function() {
      window.console.log('FUNCTION 14: GET PRINT RECTANGLE CENTER COORD');
      // Framebuffer size!!
      var rect = getPrintRectangleCoords();

      var centerCoords = [rect[0] + (rect[2] - rect[0]) / 2.0,
          rect[1] + (rect[3] - rect[1]) / 2.0];

      return centerCoords;
    };

    var updatePrintRectanglePixels = function(scale) {
      window.console.log('FUNCTION 15: UPDATE PRINT RECTANGLE PIXELS');
      if ($scope.active) {
        printRectangle = calculatePageBoundsPixels(scale);
        $scope.map.render();
      }
    };

    var getOptimalScale = function() {
      window.console.log('FUNCTION 16: GET OPTIMAL SCALE');
      window.console.log('$scope');
      window.console.log($scope);
      var size = $scope.map.getSize();
      window.console.log('size ' + size);
      var resolution = $scope.map.getView().getResolution();
      window.console.log('resolution ' + resolution);
      var width = resolution * (size[0] - ($scope.options.widthMargin * 2));
      window.console.log('width ' + width);
      var height = resolution * (size[1] - ($scope.options.heightMargin * 2));
      window.console.log('height ' + height);
      //var layoutSize = $scope.layout; 
      //window.console.log('layoutSize');
      //window.console.log(layoutSize);
      var layoutWidth = $scope.layoutWidth;
      var layoutHeight = $scope.layoutHeight;
      window.console.log('layoutWidth & layoutHeight ' + layoutWidth + ' ' + layoutHeight);
      var scaleWidth = width * UNITS_RATIO * POINTS_PER_INCH / layoutWidth;
      //    layoutSize.width;
      window.console.log('scaleWidth');
      window.console.log(scaleWidth);
      var scaleHeight = height * UNITS_RATIO * POINTS_PER_INCH / layoutHeight;
      //    layoutSize.height;
      window.console.log('scaleHeight');
      window.console.log(scaleHeight);
      var testScale = scaleWidth;
      window.console.log('testScale is equal to scaleWidth and we test is scaleHeight < testScale');
      if (scaleHeight < testScale) {
        window.console.log('yes, testScale is ' + scaleHeight);
        testScale = scaleHeight;
      }
      var nextBiggest = null;
      //The algo below assumes that scales are sorted from
      //biggest (1:500) to smallest (1:2500000)
      angular.forEach($scope.scales, function(scale) {
        if (nextBiggest == null ||
            testScale > scale) { // edw genika epaize to scale.value
              window.console.log('scale.value: ' + scale);
              nextBiggest = scale;
        }
      });
      window.console.log('nextBiggest to return: ' + nextBiggest);
      return nextBiggest;
    };

    var calculatePageBoundsPixels = function(scale) {
      window.console.log('FUNCTION 17: CALCULATE PAGE BOUNDS PIXELS');
      window.console.log('scale: ' + scale);
      //var s = parseFloat(scale.value);
      var s = parseFloat(scale);
      window.console.log('s: ' + s);
      var size = $scope.layout.map; // papersize in dot!
      //var layoutWidth = $scope.layouts.attributes.clientInfo.width;
      //window.console.log('layoutWidth: ' + layoutWidth);
      //var layoutHeight = $scope.layouts.attributes.clientInfo.height;
      //window.console.log('layoutHeight: ' + layoutHeight);
      window.console.log('to size tou layout einai ' + size);
      var view = $scope.map.getView();
      var resolution = view.getResolution();
      //instead of size.width layoutWidth, same as for size.height
      var w = size.width / POINTS_PER_INCH * MM_PER_INCHES / 1000.0 *
          s / resolution * ol.has.DEVICE_PIXEL_RATIO;
      window.console.log('w: ' + w);
      var h = size.height / POINTS_PER_INCH * MM_PER_INCHES / 1000.0 *
          s / resolution * ol.has.DEVICE_PIXEL_RATIO;
      window.console.log('h: ' + h);
      var mapSize = $scope.map.getSize();
      var center = [mapSize[0] * ol.has.DEVICE_PIXEL_RATIO / 2 ,
          mapSize[1] * ol.has.DEVICE_PIXEL_RATIO / 2];

      var minx, miny, maxx, maxy;

      minx = center[0] - (w / 2);
      miny = center[1] - (h / 2);
      maxx = center[0] + (w / 2);
      maxy = center[1] + (h / 2);
      return [minx, miny, maxx, maxy];
    };

    $scope.layers = $scope.map.getLayers().getArray();
    $scope.layerFilter = function(layer) {
      window.console.log('$SCOPE: $scope.layerFilter zeitreihen');
      return layer.bodId == 'ch.swisstopo.zeitreihen' && layer.visible;
    };
    $scope.$watchCollection('layers | filter:layerFilter', function(lrs) {
      window.console.log('$SCOPE: $scope.watchCollection multiprint');
      $scope.options.multiprint = (lrs.length == 1);
    });

    $scope.$watch('active', function(newVal, oldVal) {
      window.console.log('$SCOPE: $scope.$watch is active');
      if (newVal === true) {
        window.console.log('$scope.printConfigLoaded ' + $scope.printConfigLoaded);
        if (!$scope.printConfigLoaded) {
          loadPrintConfig().success(function(data) {
            $scope.capabilities = data;
            window.console.log('$scope.capabilities');
            window.console.log($scope.capabilities);
            window.console.log('data');
            window.console.log(data);

            angular.forEach($scope.capabilities.layouts, function(lay) {
              window.console.log('$scope.capabilities.layouts');
              window.console.log($scope.capabilities.layouts)
              window.console.log('lay');
              window.console.log(lay);
              window.console.log('lay.name ' + lay.name);

              lay.stripped = lay.name.substr(2);
              lay.map = {width: lay.attributes[5].clientInfo.width, height: lay.attributes[5].clientInfo.height};
              window.console.log('lay.map: ');
              window.console.log(lay.map);


            });
            

            // Default values
            window.console.log('DEFAULT VALUES');
            window.console.log('*****************************');

            $scope.scales = $scope.capabilities.layouts[0].attributes[5].clientInfo.scales;
            window.console.log('$scope.scales');
            window.console.log($scope.scales);
            // Default scale: 2500000
            $scope.scale = $scope.capabilities.layouts[0].attributes[5].clientInfo.scales[0];
            window.console.log('$scope.scale');
            window.console.log($scope.scale);


            $scope.layout = data.layouts[0];
            window.console.log('$scope.layout:');                
            window.console.log($scope.layout);
            $scope.layouts = data.layouts;
            window.console.log('$scope.layouts:');
            window.console.log($scope.layouts);

            //$scope.layoutHeight = $scope.layouts.attributes[5].clientInfo.height;
            //$scope.layoutWidth = $scope.layouts.attributes[5].clientInfo.width;
            //window.console.log('layoutWidth & layoutHeight ' + $scope.layoutWidth + ' ' + $scope.layoutHeight);

            $scope.dpi = data.layouts[0].attributes[5].clientInfo.dpiSuggestions;
            window.console.log('$scope.dpi ' + $scope.dpi);

            //$scope.scales = data.layouts[0].attributes[5].clientInfo.scales;
            //window.console.log('$scope.scales ' + $scope.scales);
            //$scope.scale = data.layouts[0].attributes[5].clientInfo.scales[5];
            //window.console.log('$scope.scale ' + $scope.scale);
            $scope.options.legend = false;
            $scope.options.graticule = false;
            activate();
            $scope.printConfigLoaded = true;
          });
        } else {
          activate();
        }
      } else {
        deactivate();
      }
    });

    // Because of the polling mechanisms, we can't rely on the
    // waitcursor from the NetworkStatusService. Multi-page
    // print might be underway without pending http request.
    $scope.$watch('options.printing', function(newVal, oldVal) {
      window.console.log('$SCOPE: check if $scope.$watch is active');
      if (newVal === true) {
        gaWaitCursor.increment();
      } else {
        gaWaitCursor.decrement();
      }
    });


  });

  module.directive('gaPrint',
    function(gaBrowserSniffer) {
      return {
        restrict: 'A',
        scope: {
          map: '=gaPrintMap',
          options: '=gaPrintOptions',
          active: '=gaPrintActive'
        },
        templateUrl: 'components/print/partials/print.html',
        controller: 'GaPrintDirectiveController',
        link: function(scope, elt, attrs, controller) {
          scope.isIE = gaBrowserSniffer.msie;
        }
      };
    }
  );
})();
