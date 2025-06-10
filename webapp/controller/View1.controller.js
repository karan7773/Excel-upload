    sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator"
], function(Controller, JSONModel, ODataModel, MessageBox, BusyIndicator) {
    "use strict";

    var ServiceUrl = "/sap/opu/odata/sap/Z_BAT6_KS_LAPTOP_SRV";
    var oModelData = new ODataModel(ServiceUrl, {
        useBatch: true
    });

    return Controller.extend("excelupload.controller.View1", {
        onInit: function() {
            this.getView().setModel(new JSONModel(), "uploadData");
            this.getView().setModel(new JSONModel(), "ModelData");
            this.getView().setModel(oModelData);
        },

        onValueChange: function(oEvent) {
            var files = oEvent.getParameter("files");
            if (!files || files.length === 0) return;
            
            var file = files[0];
            var reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    var data = e.target.result;
                    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
                        this.processExcel(data);
                    } else {
                        sap.m.MessageToast.show("Unsupported file type");
                    }
                } catch (error) {
                    console.error("Error processing file:", error);
                    sap.m.MessageToast.show("Error processing file");
                }
            }.bind(this);
            
            reader.onerror = function() {
                sap.m.MessageToast.show("Error reading file");
            };
            
            reader.readAsBinaryString(file);
        },
        
        processExcel: async function(excelData) {
            const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs");
            try {
                if (typeof XLSX === "undefined") {
                    throw new Error("SheetJS library not loaded");
                }
                
                var workbook = XLSX.read(excelData, {type: 'binary'});
                var sheetNo;
                if (workbook.SheetNames.length >= 1) {
                    // console.log(workbook.SheetNames.length);
                
                    this.onOpenDialog().then(function (sheetNo) {
                        if (sheetNo < 0 || sheetNo >= workbook.SheetNames.length) {
                            sap.m.MessageToast.show("Invalid sheet number.");
                            return;
                        }
                
                        var sheetName = workbook.SheetNames[sheetNo];
                        var sheet = workbook.Sheets[sheetName];
                        var jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
                
                        // Bind to model
                        this.getView().getModel("uploadData").setData(jsonData);
                        // console.log(this.getView().getModel("uploadData"));
                
                        this._buildTable(jsonData);
                
                        sap.m.MessageToast.show("Excel processed successfully: " + jsonData.length + " records");
                        // console.log(jsonData);
                    }.bind(this)).catch(function (error) {
                        console.log("Dialog cancelled or failed:", error);
                    });
                }
                
            } catch (error) {
                console.error("Excel processing error:", error);
                sap.m.MessageToast.show("Error processing Excel: " + error.message);
            }
        },

        onOpenDialog: function () {
            return new Promise((resolve, reject) => {
                if (!this._oDialog) {
                    this._oDialog = new sap.m.Dialog({
                        title: "Enter Sheet Number",
                        content: [
                            new sap.m.Label({ text: "Sheet Index (0-based)", labelFor: "sheetInput" }),
                            new sap.m.Input("sheetInput", {
                                type: "Number",
                                placeholder: "e.g., 0"
                            })
                        ],
                        beginButton: new sap.m.Button({
                            text: "OK",
                            press: function () {
                                const inputVal = sap.ui.getCore().byId("sheetInput").getValue();
                                const sheetIndex = parseInt(inputVal);
                                this._oDialog.close();
                                resolve(sheetIndex); // Send value back to caller
                            }.bind(this)
                        }),
                        endButton: new sap.m.Button({
                            text: "Cancel",
                            press: function () {
                                this._oDialog.close();
                                reject("Dialog cancelled");
                            }.bind(this)
                        }),
                        afterClose: function () {
                            this._oDialog.destroy();
                            this._oDialog = null;
                        }.bind(this)
                    });
                }
        
                this._oDialog.open();
            });
        },      
        
        _buildTable: function(aData) {
            var oView = this.getView();
            var oVBox = oView.byId("tableContainer");
            var oOldTable = oView.byId("myTableId");
            if (oOldTable) {
                oOldTable.destroy();
                oOldTable = null;
            }
            
            oVBox.removeAllItems();
            
            if (!aData || aData.length === 0) return;
            
            var oTable = new sap.m.Table({
                id: oView.createId("myTableId"), 
                inset: false,
                growing: true,
                growingThreshold: 10,
                mode: "MultiSelect"
            });
            
            var aKeys = Object.keys(aData[0]);
            aKeys.forEach(function(key) {
                oTable.addColumn(new sap.m.Column({
                    header: new sap.m.Label({ text: key })
                }));
            });
            
            var oTemplate = new sap.m.ColumnListItem({
                cells: aKeys.map(function(key) {
                    return new sap.m.Text({ text: "{uploadData>" + key + "}" });
                })
            });
            
            oTable.bindItems("uploadData>/", oTemplate);
            oVBox.addItem(oTable);
            
            this._oTable = oTable;
        },

        onUploadComplete: function(oEvent) {
            var response = oEvent.getParameter("response");
            if (response) {
                sap.m.MessageToast.show("Upload complete");
            }
        },
        
        _postDataToOData: function() {
            var oUploadModel = this.getView().getModel("uploadData");
            var aData = oUploadModel.getData();
            
            if (!aData || aData.length === 0) {
                MessageBox.error("No data to upload");
                return;
            }
            var sBatchGroupId = "postBatchGroup";            
            // Enable batch mode
            oModelData.setUseBatch(false);

            aData.forEach(function(oRow) {
                // Convert data types explicitly
                // var oPayload = {
                //     Id: parseInt(oRow.Id) || 0, // Convert to number with fallback
                //     Material_Name: String(oRow.Material_Name || ""),
                //     Material_Des: String(oRow.Material_Des || ""),
                //     Quantity: String(oRow.Quantity) || "",
                //     City: String(oRow.City || "")
                // };
                var oPayload = {}
                Object.keys(oRow).forEach(function(key) {
                    var value = oRow[key];
                    oPayload[key] = value
                });
                // console.log("Adding entry to batch with converted types:", oPayload);
                
                var path = "/laptopsSet";
                // oModelData.create(path, oPayload, {
                //     success: function() {
                //         console.log("Successfully added entry to batch");
                //     },
                //     error: function(error) {
                //         console.error("Error during batch entry creation:", error); 
                //     }
                // });
                oModelData.createEntry(path, {
                    groupId: sBatchGroupId,
                    properties: oPayload,
                    success: function(data) {
                        // console.log("Successfully created:", data);
                    },
                    error: function(error) {
                        console.error("Error creating entry:", error);
                        MessageBox.error("Error during upload. Please try again later.");
                    }
                });
            });
            // Submit changes
            oModelData.submitChanges({
                groupId: sBatchGroupId,
                success: function(oData, response) {
                    // console.log("Submit success", oData);
                    BusyIndicator.hide();
                    MessageBox.success(`Successfully uploaded records`);
                },
                error: function(oError) {
                    BusyIndicator.hide();
                    console.error("Batch POST failed", oError);
                    MessageBox.error(sErrorMsg);
                }
            });

        },

        onPostToOData: function() {
            var oUploadModel = this.getView().getModel("uploadData");
            var aData = oUploadModel.getData();
            
            if (!aData || aData.length === 0) {
                MessageBox.error("No data to upload");
                return;
            }
            
            // First validate the data
            this.validateDataBeforePost(aData)
                .then(function(validationResult) {
                    if (validationResult.hasDuplicates) {
                        MessageBox.warning(
                            `Found ${validationResult.duplicateIds.length} duplicate IDs that already exist in the system. ` +
                            `Duplicate IDs: ${validationResult.duplicateIds.join(", ")}. ` +
                            "Please correct the data before uploading."
                        );
                    } else {
                        // Proceed with actual posting if validation passes
                        this._postDataToOData(aData);
                    }
                }.bind(this))
                .catch(function(error) {
                    console.error("Validation error:", error);
                    MessageBox.error("Error during validation: " + error.message);
                });
        },

        validateDataBeforePost: function(aData) {
            return new Promise(function(resolve, reject) {
                BusyIndicator.show();
                
                // Extract all IDs from our upload data
                var uploadIds = aData.map(function(item) { return item.Id; });
                
                // Read existing IDs from OData service
                oModelData.read("/laptopsSet", {
                    urlParameters: {
                        "$select": "Id",
                        "$filter": "Id eq " + uploadIds.join(" or Id eq ")
                    },
                    success: function(oData) {
                        BusyIndicator.hide();
                        
                        var existingIds = oData.results.map(function(item) { return item.Id; });
                        var duplicateIds = uploadIds.filter(function(id) { 
                            return existingIds.includes(id); 
                        });
                        
                        resolve({
                            isValid: duplicateIds.length === 0,
                            hasDuplicates: duplicateIds.length > 0,
                            duplicateIds: duplicateIds
                        });
                    },
                    error: function(oError) {
                        BusyIndicator.hide();
                        reject(new Error("Failed to validate data against OData service"));
                    }
                });
            });
        },

        onUpdateToOData:function(){
            var oTable = this.getView().byId("myTableId")
            console.log(oTable);
            var aSelectedItems = oTable.getSelectedItems();
            if (aSelectedItems.length === 0) {
                MessageBox.warning("Please select at least one record to update");
                return;
            }
            
            var aSelectedData = aSelectedItems.map(function(oItem) {
                var oContext = oItem.getBindingContext("uploadData");
                return oContext.getObject();
            });
            
            console.log("Selected data for update:", aSelectedData);
            aSelectedData.forEach((oRow)=>{
                var oPayload = {}
                Object.keys(oRow).forEach(function(key) {
                    var value = oRow[key];
                    oPayload[key] = value
                });
                var sRecordId = parseInt(oPayload.Id, 10);
                var path = "/laptopsSet(" + sRecordId + ")";
                console.log(path);
                
                console.log(oPayload,sRecordId);
                oModelData.update(path,oPayload, {
                    success: function() {
                        console.log("Successfully updated");
                    },
                    error: function(error) {
                        console.error("Error creating entry:", error);
                        MessageBox.error("Error during upload. Please try again later.");
                    }
                });  
            });
            oModelData.submitChanges({
                groupId: "updateBatchGroup",
                success: function(oData, response) {
                    // console.log("Submit success", oData);
                    BusyIndicator.hide();
                    MessageBox.success(`Successfully uploaded records`);
                },
                error: function(oError) {
                    BusyIndicator.hide();
                    console.error("Batch POST failed", oError);
                    MessageBox.error(sErrorMsg);
                }
            });
        },

        onDeleteToOData:function(){
            if(this.getView().byId("myTableId").getSelectedItems().length> 0){
                var oTable = this.getView().byId("myTableId");
                var path= "uploadData";
            }else{
                var oTable = this.getView().byId("myModelId");
                var path = "ModelData";
            }
            // var oTable = this.getView().byId("myTableId")
            console.log(oTable);
            var aSelectedItems = oTable.getSelectedItems();
            if (aSelectedItems.length === 0) {
                MessageBox.warning("Please select at least one record to update");
                return;
            }
            
            var aSelectedData = aSelectedItems.map(function(oItem) {
                var oContext = oItem.getBindingContext(path);
                return oContext.getObject();
            });
            
            console.log("Selected data for update:", aSelectedData);
            aSelectedData.forEach((oRow)=>{
                var oPayload = {}
                Object.keys(oRow).forEach(function(key) {
                    var value = oRow[key];
                    oPayload[key] = value
                });
                var sRecordId = parseInt(oPayload.Id, 10);
                var path = "/laptopsSet(" + sRecordId + ")";
                console.log(path);
                
                console.log(oPayload,sRecordId);
                oModelData.remove(path,oPayload, {
                    success: function() {
                        console.log("Successfully updated");
                    },
                    error: function(error) {
                        console.error("Error creating entry:", error);
                        MessageBox.error("Error during upload. Please try again later.");
                    }
                });  
            });
            oModelData.submitChanges({
                groupId: "deleteBatchGroup",
                success: function(oData, response) {
                    // console.log("Submit success", oData);
                    BusyIndicator.hide();
                    MessageBox.success(`Successfully uploaded records`);
                },
                error: function(oError) {
                    BusyIndicator.hide();
                    console.error("Batch POST failed", oError);
                    MessageBox.error(sErrorMsg);
                }
            });   
        },
        
        onReadToOData: function() {
            var oView = this.getView();
            var oVBox = oView.byId("ModelContainer");
            
            // Clear previous content
            oVBox.removeAllItems();
            var oOldTable = oView.byId("myModelId");
            if (oOldTable) oOldTable.destroy();
            
            // Create empty table immediately
            var oTable = new sap.m.Table({
                id: oView.createId("myModelId"),
                inset: false,
                growing: true,
                growingThreshold: 10,
                mode: "MultiSelect"
            });
            oVBox.addItem(oTable);
            
            BusyIndicator.show();
            
            oModelData.read("/laptopsSet", {
                success: function(oData) {
                    BusyIndicator.hide();
                    
                    var oModel = oView.getModel("ModelData");
                    if (!oModel) {
                        oModel = new JSONModel();
                        oView.setModel(oModel, "ModelData");
                    }
                    
                    oModel.setData(oData.results);
                    
                    var aKeys = Object.keys(oData.results[0] || {}).filter(function(key) {
                        return !key.startsWith('__'); // Exclude __metadata, __deferred, etc.
                    });
                    
                    // Create columns only for non-metadata fields
                    aKeys.forEach(function(key) {
                        oTable.addColumn(new sap.m.Column({
                            header: new sap.m.Label({ text: key })
                        }));
                    });
                    
                    oTable.bindItems({
                        path: "ModelData>/",
                        template: new sap.m.ColumnListItem({
                            cells: aKeys.map(function(key) {
                                return new sap.m.Text({
                                    text: "{ModelData>" + key + "}"
                                });
                            })
                        }),
                        sorter: new sap.ui.model.Sorter("Id", false)
                    });
                }.bind(this),
                error: function(oError) {
                    BusyIndicator.hide();
                    MessageBox.error("Failed to load data");
                    console.error(oError);
                }
            });
        }
    });
});