var bgPage;
var tabid;
var g_ck;
var url;
var instance;
var urlFull;
var userName;
var roles;
var dtUpdateSets;
var dtUpdates;
var dtNodes;
var dtTables;
var dtDataExplore;
var dtScriptFields;
var tablesloaded = false;
var nodesloaded = false;
var dataexploreloaded = false;
var userloaded = false;
var updatesetsloaded = false;
var updatesloaded = false;
var myFrameHref;
var datetimeformat;
var table;
var sys_id;
var isNoRecord = true;
var snufsid = 'gfmcfepahcbpafgckmomdopifchjbdcg';// prod
var snufsrunning = false;


//Les premieres fonctions servent à communiquer avec la fenêtre ouverte dans le navigateur
//voir la documentation du développeur

document.addEventListener('DOMContentLoaded', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        tabid = tabs[0].id;
        urlFull = tabs[0].url;
        bgPage = chrome.extension.getBackgroundPage();
        bgPage.getBrowserVariables(tabid);


    });
    document.querySelector('#firefoxoptions').href = chrome.runtime.getURL("options.html");

});

function setIcon(icon){
    chrome.pageAction.setIcon({
    tabId: tabid,
    path : icon
    });
}

//Set variables, called by BG page after calling getRecordVariables
function setRecordVariables(obj, scriptsync) {

    isNoRecord = !obj.myVars.hasOwnProperty('NOWsysId');
    sys_id = obj.myVars.NOWsysId || obj.myVars.mySysId;
    table = obj.myVars.NOWtargetTable;

    if (!table)
        table = (myFrameHref || urlFull).match(/com\/(.*).do/)[1].replace('_list', '');
    if (!sys_id)
        sys_id = (getParameterByName('sys_id',myFrameHref || urlFull));


    var xmllink = url + '/' + obj.myVars.NOWtargetTable + '.do?sys_id=' + obj.myVars.NOWsysId + '&sys_target=&XML';
    $('#btnviewxml').click(function () {
        chrome.tabs.create({ "url" : xmllink , "active": false});
    }).prop('disabled', isNoRecord);



    $('#btnupdatesets').click(function () {
        chrome.tabs.create({ "url" : url + '/sys_update_set_list.do?sysparm_query=state%3Din%20progress' , "active": false});
    });

    if (scriptsync) {
        createScriptSyncChecboxes(table, sys_id);
    }

    $('#waitinglink, #waitingscript').hide();

}


function checkSnufsRunning() {
    chrome.runtime.sendMessage(snufsid, { checkRunning: true, instance: instance },
        function (response) {
            if (typeof response == 'undefined' &&
                typeof chrome.management !== 'undefined') {
                    $('#chromeapp').on('click', 
                    function(){
                        chrome.management.launchApp(snufsid, function (resp) { });
                    });
                    chrome.runtime.sendMessage(snufsid, { checkRunning: true, instance: instance },
                        function (res) {
                            if (typeof res == 'undefined') {
                                $('#sciptcontainerdiv').html('');
                            }
                        });
               // });
            }
        });
}

//Place the key value pair in the chrome local storage, with metafield for date added.
function setToChromeStorage(theName, theValue) {
    var myobj = {};
    myobj[instance + "-" + theName] = theValue;
    myobj[instance + "-" + theName + "-date"] = new Date().toDateString();
    chrome.storage.local.set(myobj, function () {

    });
}

//Place the key value pair in the chrome sync storage.
function setToChromeSyncStorage(theName, theValue) {
    var myobj = {};
    myobj[instance + "-" + theName] = theValue;
    chrome.storage.sync.set(myobj, function () {

    });
}

//Try to get saved form state and set it
function setFormFromSyncStorage(callback) {
    var query = instance + "-formvalues";
    chrome.storage.sync.get(query, function (result) {
        if (query in result) {
            $('form').deserialize(result[query]);
        }
        callback();
    });
}

//Try to get json with servicenow tables, first from chrome storage, else via REST api
function prepareJsonTable() {
    var query = [instance + "-tables", instance + "-tables-date"];
    chrome.storage.local.get(query, function (result) {
        try {
            var thedate = new Date().toDateString();
            if (thedate == result[query[1]].toString()) {
                setDataTableTables(result[query[0]]);
            }
            else
                bgPage.getTables();
        }
        catch (err) {
            bgPage.getTables();
        }
    });
}

//Try to get json with instance nodes, first from chrome storage, else via REST api
function prepareJsonNodes() {
    var query = [instance + "-nodes", instance + "-nodes-date"];
    chrome.storage.local.get(query, function (result) {
        try {
            var thedate = new Date().toDateString();
            if (thedate == result[query[1]].toString()) {
                bgPage.getActiveNode(result[query[0]]);
            }
            else
                bgPage.getNodes();
        }
        catch (err) {
            bgPage.getNodes();
        }
    });
}


//Try to get json with servicenow tables, first from chrome storage, else via REST api
function prepareJsonScriptFields() {
    var query = [instance + "-scriptfields", instance + "-scriptfields-date"];
    chrome.storage.local.get(query, function (result) {
        try {
            var thedate = new Date().toDateString();
            if (thedate == result[query[1]].toString()) {
                dtScriptFields = result[query[0]];
            }
            else
                bgPage.getScriptFields();
        }
        catch (err) {
            bgPage.getScriptFields();
        }
    });
}

function getParameterByName(name, url) {
    if (!url) url = window.location.href.toLowerCase();
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
    results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

//add object to storage and refresh datatable
function setScriptFields(jsn) {
    dtScriptFields = jsn;
    dtScriptFields.push( //requested to add this field
        {"internal_type.name" : "script", 
         "name" : "catalog_script_client", 
         "element" : "script"});
    setToChromeStorage("scriptfields", jsn);
}


//Set variables, called by BG page after calling getBrowserVariables
//Also attach event handlers.
function setBrowserVariables(obj) {
    
    g_ck = obj.myVars.g_ck || '';
    url = obj.url;
    instance = (new URL(url)).host.replace(".service-now.com", "");
    userName = obj.myVars.NOWusername || obj.myVars.NOWuser_name;
    //roles = obj.myVars.NOWuserroles ;
    datetimeformat = obj.myVars.g_user_date_time_format;
    myFrameHref = obj.frameHref;

    setFormFromSyncStorage(function () {
        $('.nav-tabs a[data-target="' + $('#tbxactivetab').val() + '"]').tab('show');
    });

    //Attach eventlistners
    $('#btnGetUser').click(function () {
        getUserDetails(false);
    });
    //Attach eventlistners
    $('#btncreatefiles').click(function () {
        sendToSnuFileSync();
    });
  

    $.fn.dataTable.moment('DD-MM-YYYY HH:mm:ss');
    $.fn.dataTable.moment(datetimeformat);

    $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        var target = $(e.target).data("target"); // activated tab

        $('#tbxactivetab').val(target);
        setToChromeSyncStorage("formvalues", $('form .sync').serialize());

        switch (target) {
            //Choisir d'afficher les updateset
            case "#tabupdatesets":
                if (!updatesetsloaded) {
                    $('#waitingupdatesets').show();
                    bgPage.getUpdateSets();
                    updatesetsloaded = true;
                }
                $('#tbxupdatesets').focus(function () {
                    $(this).select();
                });
                break;
            //Choisir d'afficher les données
            case "#tabdataexplore":
                if (!dataexploreloaded) {
                    $('#waitingdataexplore').show();
                     bgPage.getExploreData();
                     dataexploreloaded = true;
                }
                $('#tbxdataexplore').focus(function () {
                    $(this).select();
                });
                break;        
        }

    });

    chrome.tabs.sendMessage(tabid, { method: "getSelection" }, function (selresponse) {
        var selectedText = ('' + selresponse.selectedText).trim();
        if (selectedText.length > 0 && selectedText.length <= 30)
            getUserDetails(selectedText);

    });


}

//Set message, on about tab, callback from getInfoMessage
function setInfoMessage(html) {
    $('#livemessage').html(html);
}

function getSettings(){
    bgPage.getFromSyncStorageGlobal("snusettings", function(settings){
        for (var setting in settings){
            document.getElementById(setting).checked = settings[setting];
        };
    })
}

function setSettings(){
    var snusettings = {};
    $('input.snu-setting').each(function (index, item) {
        snusettings[this.id] = this.checked;
    });
    bgPage.setToChromeSyncStorageGlobal("snusettings",snusettings);
}


function getGRQuery() {

    var newHref = myFrameHref || urlFull;
    if ((newHref.split('?')[0]).indexOf('_list.do') > 1) {
        bgPage.getGRQuery($('#tbxgrname').val(),$('#tbxgrtemplate').val());
    }
    else {
        bgPage.getGRQueryForm($('#tbxgrname').val(),$('#tbxgrtemplate').val());
    }
}

function setGRQuery(gr) {
    if (gr.indexOf("GlideRecord('undefined')")  > -1) gr = "This only works in forms and lists.";
        $('#txtgrquery').val(gr).select();
}



//next release, integrate with other extension
function createScriptSyncChecboxes(tbl, sysid) {
    var fields = [];
    if (dtScriptFields) {
        fields = dtScriptFields.filter(function (el) {
            return el.name == tbl;
        }).sort();
    }

    if (fields.length == 0) {
        $('#sciptcontainerdiv').html('No fields to edit found on current page..');
        return;
    }

    $('#scripttable').html(tbl);

    if (fields) {
        var scripthtml = '';
        for (var i = 0; i < fields.length; i++) {
            var checked = (fields[i].element == 'script') ? 'checked="checked"' : '';

            scripthtml += '<div class="form-check checkbox"><label class="form-check-label"><input class="form-check-input scriptcbx" data-type="' + fields[i]['internal_type.name'] + 
                '" type="checkbox" ' + checked +
                ' value="' + fields[i].element + '">' + fields[i].element + ' (' + fields[i]['internal_type.name'] + ')</label></div>';

        }
        $('#scriptform').html(scripthtml);
    }
}

function sendToSnuFileSync() {

    var url = 'https://' + instance + '.service-now.com/api/now/table/' + table + '/' + sys_id;

    bgPage.loadXMLDoc(g_ck, url, "", function (respons) {
        var idx = 0;
        $('input.scriptcbx:checked').each(function (index, item) {
            var tpe = $(this).data('type');
            //console.log('div' + value + ':' + $(this).data('type'));
            idx++;
            var ext = '.js';
            if (tpe.indexOf('html') > -1) ext = '.html';
            else if (tpe.indexOf('xml') > -1) ext = '.xml';
            chrome.runtime.sendMessage(
                snufsid,
                {
                    instance: instance,
                    table: table,
                    sys_id: sys_id,
                    field: item.value,
                    name: respons.result.name || 'unknown',
                    extension: ext,
                    content: respons.result[item.value] || ''
                },
                function (response) {
                    // console.log(response);
                });
        });
        $('#scriptmessage').html(idx + ' file(s) created');

    });

}

//Initiate Call to servicenow rest api
function getUserDetails(usr) {
    if (!usr) usr = $('#tbxname').val();
    $('#tbxname').val(usr);
    $('#waitinguser').show();
    bgPage.getUserDetails(usr);
}



// Définir ou actualiser les données avec les mises à jour ServiceNow
//Avec en paramètre une variable user qui représente l'utilisateur
//Voir fonction getBrowserVariables() dans fichier background.js

function setDataTableUpdateSets(user) {

    //L'utilisateur (user) n'est pas connécté
    //Liste update set n'est pas généré et affiche erreur
    if (user == 'error'){
        $('#updatesets').hide().after('<br /><div class="alert alert-danger">Data can not be retrieved, are you Admin?</div>');
        $('#waitingupdatesets').hide();
        return false;
    }
    
    //Récupère les updatesets et les affiche avec leurs états dans la div ou on appel l'id updatesets
    if (dtUpdateSets) dtUpdateSets.destroy();
    dtUpdateSets = $('#updatesets').DataTable({
        "aaData": user.result.updateSet,
        "aoColumns": [
            { "mDataProp": "name" },

        
            //Donne l'état de l'update set
            {
                mRender: function (data, type, row) {
                    var iscurrent = "";
                    if (row.sysId == user.result.current.sysId) iscurrent = "iscurrent";
                    return "<a class='updatesetlist' href='" + url + "/nav_to.do?uri=sys_update_set.do?sys_id=" + row.sysId + "' title='Table definition' ><i class='fa fa-list' aria-hidden='true'></i></a> " +
                        "<a class='setcurrent " + iscurrent + "' data-post='{name: \"" + row.name + "\", sysId: \"" + row.sysId + "\"}' href='#" + row.sysId + "' title='Set current updateset'><i class='fa fa-dot-circle-o' aria-hidden='true'></i></a> ";
                }
            }
        ],
        "drawCallback": function () {
            var row0 = $("#updatesets tbody tr a.iscurrent").closest('tr').clone();
            $('#updatesets tbody tr:first').before(row0.css('background-color', '#5ebeff'));
        },
        
        "paging": false
    });
  
    $('#waitingupdatesets').hide();

}


//add object to storage and refresh datatable
function setTables(jsn) {
    setToChromeStorage("tables", jsn);
    setDataTableTables(jsn);
}



//set or refresh datatable with ServiceNow tables
function setDataExplore(user) {

    if (dtDataExplore) dtTables.destroy();
//$('#dataexplore').html(user);
    dtDataExplore = $('#dataexplore').DataTable({
        "aaData": user,
        "aoColumns": [

            { "mDataProp": "meta.label"},
            { "mDataProp": "display_value"}
        ],
        "bLengthChange": false,
        "bSortClasses": false,
        "paging": false,
        "dom": 'rti<"btns"B>',
        "buttons": [
        "copyHtml5",  
            {
                text: 'Toggle Type',
                action: function ( e, dt, node, config ) {
                    var vis = !dtDataExplore.column(2).visible();
                    dtDataExplore.column(2).visible(vis);

                }
            }
        ]

    });

    $('#tbxdataexplore').keyup(function () {
        dtDataExplore.search($(this).val()).draw();
    }).focus().trigger('keyup');

    $('a.referencelink').click(function () {
        event.preventDefault();
        chrome.tabs.create({ "url" : $(this).attr('href')  , "active" : !(event.ctrlKey||event.metaKey) });
    });


    $('#waitingdataexplore').hide();

}

