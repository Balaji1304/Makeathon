sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("greentrack.controller.RoutePlanner", {

        onInit: function () {
            // Initialize route data model
            const oRouteModel = new JSONModel({
                Routes: [
                    {
                        RouteID: "RT-001",
                        RouteName: "Berlin - Hamburg - Bremen",
                        Distance: 425,
                        Duration: "5h 30m",
                        CO2Emissions: 85,
                        EmissionLevel: "low",
                        FuelCost: 120,
                        Status: "active",
                        AssignedVehicle: "VH-001 (Electric Van)",
                        OptimizationMode: "eco",
                        Waypoints: [
                            {
                                Type: "start",
                                Location: "Berlin Distribution Center",
                                Address: "Hauptstraße 123, 10115 Berlin",
                                ETA: "08:00",
                                StopDuration: "0 min"
                            },
                            {
                                Type: "stop",
                                Location: "Hamburg Warehouse",
                                Address: "Hafenstraße 45, 20095 Hamburg",
                                ETA: "10:45",
                                StopDuration: "30 min"
                            },
                            {
                                Type: "stop",
                                Location: "Bremen Logistics Hub",
                                Address: "Industrieweg 78, 28195 Bremen",
                                ETA: "13:15",
                                StopDuration: "45 min"
                            },
                            {
                                Type: "end",
                                Location: "Bremen Final Depot",
                                Address: "Endstraße 12, 28199 Bremen",
                                ETA: "14:30",
                                StopDuration: "0 min"
                            }
                        ]
                    },
                    {
                        RouteID: "RT-002",
                        RouteName: "Munich - Stuttgart - Frankfurt",
                        Distance: 515,
                        Duration: "6h 45m",
                        CO2Emissions: 165,
                        EmissionLevel: "medium",
                        FuelCost: 185,
                        Status: "planned",
                        AssignedVehicle: "VH-002 (Diesel Truck)",
                        OptimizationMode: "fastest",
                        Waypoints: [
                            {
                                Type: "start",
                                Location: "Munich Hub",
                                Address: "Münchner Str. 89, 80331 München",
                                ETA: "07:00",
                                StopDuration: "0 min"
                            },
                            {
                                Type: "stop",
                                Location: "Stuttgart Center",
                                Address: "Stuttgarter Platz 34, 70173 Stuttgart",
                                ETA: "09:30",
                                StopDuration: "1h 15min"
                            },
                            {
                                Type: "end",
                                Location: "Frankfurt Main Station",
                                Address: "Am Hauptbahnhof 1, 60329 Frankfurt",
                                ETA: "13:45",
                                StopDuration: "0 min"
                            }
                        ]
                    },
                    {
                        RouteID: "RT-003",
                        RouteName: "Cologne - Dortmund - Essen",
                        Distance: 185,
                        Duration: "2h 45m",
                        CO2Emissions: 0,
                        EmissionLevel: "zero",
                        FuelCost: 45,
                        Status: "active",
                        AssignedVehicle: "VH-003 (Electric Van)",
                        OptimizationMode: "eco",
                        Waypoints: [
                            {
                                Type: "start",
                                Location: "Cologne Depot",
                                Address: "Kölner Ring 23, 50667 Köln",
                                ETA: "09:00",
                                StopDuration: "0 min"
                            },
                            {
                                Type: "stop",
                                Location: "Dortmund Warehouse",
                                Address: "Dortmunder Allee 56, 44137 Dortmund",
                                ETA: "10:15",
                                StopDuration: "30 min"
                            },
                            {
                                Type: "end",
                                Location: "Essen Final Drop",
                                Address: "Essener Str. 90, 45127 Essen",
                                ETA: "11:45",
                                StopDuration: "0 min"
                            }
                        ]
                    }
                ]
            });
            
            this.getView().setModel(oRouteModel);
            
            // Model for selected route details
            const oSelectedRouteModel = new JSONModel({});
            this.getView().setModel(oSelectedRouteModel, "selectedRoute");
        },

        onRouteSelect: function (oEvent) {
            const oSelectedItem = oEvent.getParameter("listItem");
            const oContext = oSelectedItem.getBindingContext();
            const oRouteData = oContext.getObject();
            
            // Set selected route to detail model
            this.getView().getModel("selectedRoute").setData(oRouteData);
        },

        onSearchRoutes: function (oEvent) {
            const sQuery = oEvent.getParameter("query");
            const oList = this.byId("routeList");
            const oBinding = oList.getBinding("items");
            
            if (sQuery) {
                const aFilters = [
                    new sap.ui.model.Filter("RouteID", sap.ui.model.FilterOperator.Contains, sQuery),
                    new sap.ui.model.Filter("RouteName", sap.ui.model.FilterOperator.Contains, sQuery)
                ];
                const oFilter = new sap.ui.model.Filter({
                    filters: aFilters,
                    and: false
                });
                oBinding.filter(oFilter);
            } else {
                oBinding.filter([]);
            }
        },

        onCreateRoute: function () {
            MessageToast.show("Create new route dialog would open here");
            // Implement route creation dialog
        },

        onEditRoute: function () {
            MessageToast.show("Edit route functionality");
        },

        onDeleteRoute: function () {
            MessageBox.confirm("Are you sure you want to delete this route?", {
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        MessageToast.show("Route deleted");
                    }
                }
            });
        },

        onChangeVehicle: function () {
            MessageToast.show("Vehicle selection dialog would open here");
        },

        onOptimizationChange: function (oEvent) {
            const sKey = oEvent.getParameter("item").getKey();
            MessageToast.show("Optimization mode changed to: " + sKey);
            // Recalculate route based on optimization mode
        },

        onAddWaypoint: function () {
            MessageToast.show("Add waypoint dialog would open here");
        },

        onMoveWaypointUp: function (oEvent) {
            MessageToast.show("Move waypoint up");
            // Implement waypoint reordering logic
        },

        onMoveWaypointDown: function (oEvent) {
            MessageToast.show("Move waypoint down");
            // Implement waypoint reordering logic
        },

        onDeleteWaypoint: function (oEvent) {
            MessageBox.confirm("Remove this waypoint?", {
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        MessageToast.show("Waypoint removed");
                    }
                }
            });
        },

        onSaveRoute: function () {
            MessageToast.show("Route saved successfully");
            // Implement save logic
        },

        onCancel: function () {
            MessageBox.confirm("Discard changes?", {
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        // Navigate back or reset
                    }
                }
            });
        },

        // Formatters
        formatRouteStatus: function (sStatus) {
            const mStatusState = {
                "active": "Success",
                "planned": "Warning",
                "completed": "Information",
                "cancelled": "Error"
            };
            return mStatusState[sStatus] || "None";
        },

        formatEmissionColor: function (sLevel) {
            const mColors = {
                "zero": "Positive",
                "low": "Good",
                "medium": "Critical",
                "high": "Negative"
            };
            return mColors[sLevel] || "Default";
        },

        formatEmissionState: function (sLevel) {
            const mStates = {
                "zero": "Success",
                "low": "Success",
                "medium": "Warning",
                "high": "Error"
            };
            return mStates[sLevel] || "None";
        },

        formatWaypointIcon: function (sType) {
            const mIcons = {
                "start": "sap-icon://source-code",
                "stop": "sap-icon://flag",
                "end": "sap-icon://trip-report"
            };
            return mIcons[sType] || "sap-icon://locate-me";
        }
    });
});
