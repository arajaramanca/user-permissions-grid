Ext.define("TSApp", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {       
                xtype:'container',
                itemId:'container_header',
                layout: {
                        type: 'hbox',
                        align: 'stretch'
                }
        },
        {xtype:'container',itemId:'container_body'}
    ],

    integrationHeaders : {
        name : "TSApp"
    },
                        
    launch: function() {
        this._myMask = new Ext.LoadMask(Ext.getBody(), {msg:"Please wait.This may take long depending on the size of your data..."});
        this._myMask.show();
        var me = this;
        me.setLoading("Loading stuff...");
        me._loadAStoreWithAPromiseWithModel();
    },
    
    _loadByName: function(){
        var me = this;

        userNameComboBox = Ext.create('Rally.ui.combobox.UserSearchComboBox', {
                itemId: 'nameComboBox',
                fieldLabel: 'Filter By User',
                labelAlign: 'right',
                allowClear : true,
                listeners: {
                    select: me._filterStore,
                    ready: me._loadAStoreWithAPromiseWithModel,
                    scope: me
                }
        });
        me.down('#container_header').add(userNameComboBox);

    },

    _filterStore: function(userNameComboBox){
        var userNameComboBoxValue = userNameComboBox.getRecord().get('UserName');
        console.log(userNameComboBoxValue);
        var localGrid = this.down('rallygrid');
        if(localGrid){
            var store = localGrid.getStore();
            store.filterBy(function(record){
                console.log('Filter By',record.get('UserName'),userNameComboBoxValue);
                    console.log(record.get('UserName') == userNameComboBoxValue);

                if(record.get('UserName') == userNameComboBoxValue){
                    console.log('Before returning');
                    return true;
                }else
                {
                    return false;
                }
            });
        }
    },

    _loadAStoreWithAPromiseWithModel: function(){
        var me = this;
        var model_name = 'User',
            field_names = ['FirstName','LastName','UserName','SubscriptionPermission','Role'];
        
        this._loadAStoreWithAPromise(model_name, field_names).then({
            scope: this,
            success: function(store) {
                //console.log('store on succe',store);
                this._myMask.hide();
                this._displayGrid(store);
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });
    } ,

  

    //TODO: this and me are used in code interchangeably - need to cleanup
    _loadAStoreWithAPromise: function(model_name, model_fields){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        me.logger.log("Starting load:",model_name,model_fields);

        

       // var selectedUserNameValue = this.down('#nameComboBox').getRecord().get('UserName');   
        //console.log('myFilters',selectedUserNameValue);
        //var myFilters = me._getUserFilter(selectedUserNameValue);
        //console.log('userNameComboBox',selectedUserNameValue);
        //console.log(myFilters);
        //    console.log('myFilters',myFilters);

        // if(this._initial_store){
        //     //console.log('store exists',this._initial_store);
        //     this._initial_store.clearFilter(true);
        //     this._initial_store.load();
        //     console.log(this._initial_store);
        //     return deferred.promise;

        // } else {

            Ext.create('Rally.data.wsapi.Store', {
                model: model_name,
                fetch: model_fields,
                limit: Infinity
                
            }).load({
                callback : function(records, operation, successful) {
                    if (successful){
                        var promises = [];
                        _.each(records, function(result){
                            promises.push(this._getColleciton(result));
                        },this);
                        console.log('promises>>',promises);
                        Deft.Promise.all(promises).then({
                            success: function(results){
                                var usersAndPermission = [];
                                var users = [];
                                var length = records.length;
                                //TODO clean up the for loop.
                                for (var i = 0; records && i < records.length; i++) {
                                    if(records[i].get('SubscriptionPermission')=='Subscription Admin'){

                                        var user = {
                                            FullName: records[i].get('FirstName') + ' ' +records[i].get('LastName'),
                                            UserName: records[i].get('UserName'),
                                            SubscriptionPermission: records[i].get('SubscriptionPermission'),
                                            UserPermission: null,
                                            Role: records[i].get('Role')
                                        }
                                        users.push(user);
                                        continue;

                                    }

                                    var permissionArr = results[i];

                                    if(permissionArr && permissionArr.length > 0){
                                       for (var j = 0; permissionArr && j < permissionArr.length; j++) {
                                            var user = {
                                                FullName: records[i].get('FirstName') + ' ' +records[i].get('LastName'),
                                                UserName: records[i].get('UserName'),
                                                SubscriptionPermission: records[i].get('SubscriptionPermission'),
                                                UserPermission: permissionArr[j],
                                                Role: records[i].get('Role')
                                            }
                                            users.push(user);
                                        }

                                    }else{
                                        var user = {
                                            FullName: records[i].get('FirstName') + ' ' +records[i].get('LastName'),
                                            UserName: records[i].get('UserName'),
                                            SubscriptionPermission: records[i].get('SubscriptionPermission'),
                                            UserPermission: null,
                                            Role: records[i].get('Role')
                                        }
                                        users.push(user);
                                    }

                                }
                                console.log('UserS >>',users);
                                // create custom store (call function ) combine permissions and results in to one.
                                var store = Ext.create('Rally.data.custom.Store', {
                                    data: users,
                                    scope: this
                                });
                                me._initial_store = store;
                                console.log('Initial store',store);    
                                deferred.resolve(store);                        
                            }
                        });
                    } else {
                        me.logger.log("Failed: ", operation);
                        deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                    }
                },
                scope: me
            });
            return deferred.promise;
            // }
    },

    _getColleciton: function(record){
        var deferred = Ext.create('Deft.Deferred');
                            record.getCollection('UserPermissions').load({
                                fetch: ['Role', 'Name', '_type','Workspace','Project'],
                                callback: function(records, operation, success) {
                                    deferred.resolve(records);
                            }
                        });        
        return deferred;
    },

    _displayGrid: function(store){
      console.log('store before createing the grid',store);
      this._grid = this.down('#container_body').add({
            xtype: 'rallygrid',
            store: store,
            //showPagingToolbar: false,
            columnCfgs: [
                {
                    text: 'Name', 
                    dataIndex: 'FullName',
                    flex: 1
                },
                {
                    text: 'User Name', 
                    dataIndex: 'UserName',
                    flex: 2

                },
                {
                    text: 'Workspace',
                    dataIndex: 'UserPermission',
                    flex: 1,
                    renderer: function(UserPermission){
                        var text = [];
                        if(UserPermission){
                            if (UserPermission.get('_type') == 'workspacepermission' ){
                                text.push(UserPermission.get('Name'));
                            }
                        }else{
                            text.push('NA');
                        }

                        return text;
                    }
                },
                {
                    text: 'Project',
                    dataIndex: 'UserPermission',
                    flex: 1,
                    renderer: function(UserPermission){
                        var text = [];
                        if(UserPermission){
                            if(UserPermission.get('_type') == 'projectpermission' ){
                                text.push(UserPermission.get('Name'));
                            }
                        }else{
                            text.push('NA');
                        }

                        return text;
                    }
                },
                {
                    text: 'Role',
                    dataIndex: 'UserPermission',
                    flex: 1,
                    renderer: function(UserPermission){
                        var text = [];
                        if(UserPermission){
                            if(UserPermission.get('_type') == 'projectpermission' || UserPermission.get('_type') == 'workspacepermission' ){
                             text.push(UserPermission.get('Role') );
                            }else{
                            text.push('NA');
                            }

                        }else{
                            text.push('NA');
                        }


                        return text;
                    }
                },
                {
                    text: 'Subscription Permission', 
                    dataIndex: 'SubscriptionPermission',
                    flex: 1
                }
                
            ]

        });

        this.down('#container_body').add(this._grid);

         this.down('#container_header').add({
            xtype:'rallybutton',
            itemId:'export_button',
            text: 'Download CSV',
            disabled: false,
            iconAlign: 'right',
            listeners: {
                scope: this,
                click: function() {
                    this._export();
                }
            },
            scope: this
        });
        
    },

    // _getUserFilter: function(selectedUserNameValue) {
    //     console.log('Inside _getUserFilter' ,selectedUserNameValue);
    //     if(!selectedUserNameValue){
    //         return {};
    //     }else{
    //         return Ext.create('Rally.data.wsapi.Filter', {
    //             property: 'UserName',
    //             operator: '=',
    //             value: selectedUserNameValue
    //          });
    //     }    
    // },

    _getUserFilter: function(selectedUserNameValue) {
        var filter = [];

        if (selectedUserNameValue) {
            filter.push({
                property: 'UserName',                                 
                operator: '=',
                value: selectedUserNameValue
            });
        }
        return filter;
    },

   
    _export: function(){
        var grid = this.down('rallygrid');
        var me = this;

        if ( !grid ) { return; }
        
        this.logger.log('_export',grid);

        var filename = Ext.String.format('user-permissions.csv');

        this.setLoading("Generating CSV");
        Deft.Chain.sequence([
            function() { return Rally.technicalservices.FileUtilities._getCSVFromCustomBackedGrid(grid) } 
        ]).then({
            scope: this,
            success: function(csv){
                if (csv && csv.length > 0){
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv,filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
                }
                
            }
        }).always(function() { me.setLoading(false); });
    },

    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        this.launch();
    }
});
