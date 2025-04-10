sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator"
], function(Controller, JSONModel, ODataModel, MessageBox, BusyIndicator) {
    "use strict";

    var ServiceUrl = "/sap/opu/odata/sap/Z_BAT6_LAP_SRV";
    var oModelData = new ODataModel(ServiceUrl, {
        useBatch: true
    });

    return Controller.extend("excelupload.controller.View1", {
        onInit: function() {
            this.getView().setModel(new JSONModel(), "uploadData");
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
                var firstSheetName = workbook.SheetNames[0];
                var firstSheet = workbook.Sheets[firstSheetName];
                var jsonData = XLSX.utils.sheet_to_json(firstSheet, {defval: ""});
                
                // Bind to model
                this.getView().getModel("uploadData").setData(jsonData);
                console.log(this.getView().getModel("uploadData"));
                
                
                sap.m.MessageToast.show("Excel processed successfully: " + jsonData.length + " records");
                console.log(jsonData);
                
                
            } catch (error) {
                console.error("Excel processing error:", error);
                sap.m.MessageToast.show("Error processing Excel: " + error.message);
            }
        },
        
        onUploadComplete: function(oEvent) {
            var response = oEvent.getParameter("response");
            if (response) {
                sap.m.MessageToast.show("Upload complete");
            }
        },
        
        onPostToOData: function() {
            var oUploadModel = this.getView().getModel("uploadData");
            var aData = oUploadModel.getData();
            
            if (!aData || aData.length === 0) {
                MessageBox.error("No data to upload");
                return;
            }
            var sBatchGroupId = "postBatchGroup";            
            // Enable batch mode
            oModelData.setUseBatch(true);

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
                console.log("Adding entry to batch with converted types:", oPayload);
                
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
                        console.log("Successfully created:", data);
                    },
                    error: function(error) {
                        console.error("Error creating entry:", error);
                        MessageBox.error("Error during upload. Please try again later.");
                    }
                });
            });
            // Submit changes
            oModelData.submitChanges(sBatchGroupId, {
                success: function(oData, response) {
                    BusyIndicator.hide();
                    MessageBox.success(`Successfully uploaded ${aData.length} records`);
                },
                error: function(oError) {
                    BusyIndicator.hide();
                    console.error("Batch POST failed", oError);
                    MessageBox.error(sErrorMsg);
                }
            });

        }
    });
});