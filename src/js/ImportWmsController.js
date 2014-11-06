(function() {
  goog.provide('ga_importwms_controller');

  var module = angular.module('ga_importwms_controller', []);

  module.controller('GaImportWmsController',
    function($scope, gaGlobalOptions) {
       $scope.options = {  
         proxyUrl: gaGlobalOptions.ogcproxyUrl,
         defaultGetCapParams: 'SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0',
         defaultWMSList: [
           'http://wms.geo.admin.ch/',
           'http://ogc.heig-vd.ch/mapserver/wms?',
           'http://www.gis.stadt-zuerich.ch/maps/services/wms/WMS-ZH-STZH-OGD/MapServer/WMSServer?',
           'http://wms.geo.gl.ch/?',
           'http://mapserver1.gr.ch/wms/admineinteilung?',
           'http://mapserver1.gr.ch/wms/belastetestandorte?',
           'http://mapserver1.gr.ch/wms/beweidbareflaechen?',
           'http://mapserver1.gr.ch/wms/generellererschliessungsplan?',
           'http://mapserver1.gr.ch/wms/generellergestaltungsplan?',
           'http://mapserver1.gr.ch/wms/gewaesserschutz?',
           'http://mapserver1.gr.ch/wms/grundlagen_richtplanung?',
           'http://mapserver1.gr.ch/wms/grundwasser?',
           'http://mapserver1.gr.ch/wms/historischekarten?',
           'http://mapserver1.gr.ch/cgi-bin/wms/landwirtschaft?',
           'http://mapserver1.gr.ch/wms/naturgefahren_erfassungsbereiche?',
           'http://mapserver1.gr.ch/wms/naturschutz?',
           'http://mapserver1.gr.ch/wms/regionen?',
           'http://mapserver1.gr.ch/wms/seilbahnen?',
           'http://mapserver1.gr.ch/wms/amtlichevermessung_stand?',
           'http://mapserver1.gr.ch/wms/wildruhezonen?',
           'http://mapserver1.gr.ch/wms/wildschutzgebiete?',
           'http://mapserver1.gr.ch/wms/zonenplan?',
           'http://www.sogis1.so.ch/cgi-bin/sogis/sogis_geologie.wms?',
           'http://www.sogis1.so.ch/cgi-bin/sogis/sogis_gewaesser.wms?',
           'http://www.sogis1.so.ch/cgi-bin/sogis/sogis_natgef.wms?',
           'http://www.sogis1.so.ch/cgi-bin/sogis/sogis_oeko.wms?',
           'http://www.sogis1.so.ch/cgi-bin/sogis/sogis_richt.wms?',
           'http://www.sogis1.so.ch/cgi-bin/sogis/sogis_verkehr.wms?',
           'http://www.sogis1.so.ch/cgi-bin/sogis/sogis_wander.wms?',
           'http://www.sogis1.so.ch/wms/avwms?',
           'http://www.sogis1.so.ch/cgi-bin/sogis/sogis_grundbuch.wms?',
           'http://www.sogis1.so.ch/cgi-bin/sogis/sogis_bpav.wms?',
           'http://www.sogis1.so.ch/cgi-bin/sogis/sogis_strassenkarte.wms?',
           'http://www.sogis1.so.ch/cgi-bin/sogis/sogis_ortho.wms?',
           'http://www.sogis1.so.ch/cgi-bin/sogis/sogis_dtm_dom.wms?',
           'http://cartoserver.vd.ch/ogcccgeo/wms?',
           'http://www.gis.zh.ch/scripts/kkgeowms.asp?',
           'http://wms.geo.bs.ch/wmsBS?',
           'http://vogis.cnv.at/mapserver/mapserv?map=i_flaechenwidmung_v_wms.map',
           'http://vogis.cnv.at/mapserver/mapserv?map=i_luftbilder_r_wms.map',
           'http://vogis.cnv.at/mapserver/mapserv?map=i_hoehen_und_gelaende_r_wms.map',
           'http://vogis.cnv.at/mapserver/mapserv?map=i_relief_r_wms.map',
           'http://vogis.cnv.at/mapserver/mapserv?map=i_historischekarten_r_wms.map',
           'http://vogis.cnv.at/mapserver/mapserv?map=i_naturschutz_v_wms.map',
           'http://vogis.cnv.at/mapserver/mapserv?map=i_topographie_r_wms.map',
           'http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/raster/IGM_100000.map',
           'http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/raster/IGM_25000.map',
           'http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/raster/IGM_250000.map',
           'http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/raster/DTM_20M.map',
           'http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/Vettoriali/Rete_ferroviaria.map',
           'http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/Vettoriali/Rete_stradale.map',
           'http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/raster/ortofoto_colore_06.map',
           'http://wms.zh.ch/FnsInvZHWMS',
           'http://wms.zh.ch/FNSLRPZHWMS',
           'http://wms.zh.ch/WaldVKWMS',
           'http://wms.zh.ch/OrtsbildschutzZHWMS',
           'http://wms.zh.ch/VelonetzZHWMS',
           'http://wms.zh.ch/FNSOEQVZHWMS',
           'http://wms.zh.ch/DenkmalschutzWMS',
           'http://wms.zh.ch/FnsSVOZHWMS',
           'http://wms.zh.ch/HaltestellenZHWMS',
           'http://wms.zh.ch/FnsLWZHWMS',
           'http://wms.zh.ch/ArchWMS',
           'http://www.geoservice.apps.be.ch/geoservice/services/a4p/a4p_kbswms_d_fk_s/MapServer/WMSServer?',
           'http://www.geoservice.apps.be.ch/geoservice/services/a4p/a4p_basiswms_d_fk_s/MapServer/WMSServer?',
           'http://www.geoservice.apps.be.ch/geoservice/services/a4p/a4p_grenzenwms_d_fk_s/MapServer/WMSServer?',
           'http://www.geoservice.apps.be.ch/geoservice/services/a4p/a4p_planungwms_d_fk_s/MapServer/WMSServer?',
           'http://www.geoservice.apps.be.ch/geoservice/services/a4p/a4p_umweltwms_d_fk_s/MapServer/WMSServer?',
           'http://www.geoservice.apps.be.ch/geoservice/services/a4p/a4p_geologiewms_d_fk_s/MapServer/WMSServer?',
           'http://www.geoservice.apps.be.ch/geoservice/services/a4p/a4p_gewaesserwms_d_fk_s/MapServer/WMSServer?'
         ]
       };
     });
})();
