<%inherit file="base.mako"/>

<%def name="table_body(c, lang)">
<% 
    c['stable_id'] = True
    lang = lang if lang in ('fr','it','en') else 'de'
    lang = lang if lang != 'it' else 'fr'
    damtype = 'damtype_%s' % lang
%>
    <tr><td class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_damname')}</td>           <td>${c['attributes']['damname']}</td></tr>
    <tr><td class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_damtype')}</td>           <td>${c['attributes'][damtype] or '-'}</td></tr>
    <tr><td class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_damheight')}</td>         <td>${int(c['attributes']['damheight']) or '-'}&nbsp;m</td></tr>
    <tr><td class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_crestlevel')}</td>        <td>${int(c['attributes']['crestlevel']) or '-'}&nbsp;${_('abk_meter_ueber_meer')}</td></tr>
    <tr><td class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_crestlength')}</td>       <td>${int(c['attributes']['crestlength']) or '-'}&nbsp;m</td></tr>
</%def>

<%def name="extended_info(c, lang)">
    <%
        c['stable_id'] = True
        lang = lang if lang in ('fr','it','en') else 'de'
        lang = lang if lang != 'it' else 'fr'
        damtype = 'damtype_%s' % lang
    %>
    <h1>${_('tt_ch.bfe.stauanlagen-bundesaufsicht_stauanlage')} ${c['attributes']['facilityname']}</h1>
    <table class="table-with-border kernkraftwerke-extended">
        <tr>
            <th class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_stauanlage')}</th>
            <td>${c['attributes']['facilityname']}</td>
        </tr>
        <tr>
            <th class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_inbetriebabnahme')}</th>
            <td>${c['attributes']['beginningofoperation']}</td>
        </tr>
        <tr>
            <th class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_zweck')}</th>
            <td>${c['attributes']['facaim_'+lang]}</td>
        </tr>
        <tr>
            <th class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_aufsichtstart')}</th>
            <td>${c['attributes']['startsupervision']}</td>
        </tr>
        <tr>
            <td colspan="2">&nbsp;</td>
        </tr>
        <tr>
            <th class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_stauraum')}</th>
            <td>${c['attributes']['reservoirname']}</td>
        </tr>
        <tr>
            <th class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_stauraumvolume')}</th>
            <td>${c['attributes']['impoundmentvolume']} 10<sup>6</sup> [m<sup>3</sup>]</td>
        </tr>
        <tr>
            <th class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_stauzielskote')}</th>
            <td>${c['attributes']['impoundmentlevel']} [m]</td>
        </tr>
        <tr>
            <th class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_stauhoehe')}</th>
            <td>${c['attributes']['storagelevel']} [m]</td>
        </tr>
        <tr>
            <td colspan="2">&nbsp;</td>
        </tr>
        <tr>
            <th class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_sperre')}</th>
            <td>${c['attributes']['damname']}</td>
        </tr>
        <tr>
            <th class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_damheight')}</th>
            <td>${c['attributes']['damheight']} [m]</td>
        </tr>
        <tr>
            <th class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_crestlevel')}</th>
            <td>${c['attributes']['crestlevel']} [m]</td>
        </tr>
        <tr>
            <th class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_crestlength')}</th>
            <td>${c['attributes']['crestlength']} [m]</td>
        </tr>
        <tr>
            <th class="cell-left">${_('tt_ch.bfe.stauanlagen-bundesaufsicht_damtype')}</th>
            <td>${c['attributes'][damtype]}</td>
        </tr>
    </table>
</%def>