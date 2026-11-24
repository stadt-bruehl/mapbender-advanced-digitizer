(function() {
    "use strict";
    window.Mapbender = window.Mapbender || {};
    window.Mapbender.AdvancedDigitizer = Mapbender.AdvancedDigitizer || {};

    function getPolygons(geometry) {
        switch (geometry.getType()) {
            case 'MultiPolygon':
                return geometry.getPolygons();
            case 'Polygon':
                return [geometry];
            default:
                return [];
        }
    }

    class RemovePartInteraction extends ol.interaction.Interaction {
        /**
         * @param {function(): (ol.Feature|null)} getTarget
         */
        constructor(getTarget) {
            super();
            this.getTarget_ = getTarget;
        }

        handleEvent(evt) {
            const feature = evt.type === 'singleclick' && ol.events.condition.noModifierKeys(evt) && this.getTarget_();
            if (!feature) {
                return true;
            }
            const map = evt.map;
            // ol.interaction.Snap (handled before) may have moved evt.coordinate onto a part boundary
            const coordinate = map.getCoordinateFromPixel(map.getEventPixel(evt.originalEvent));
            const polygons = getPolygons(feature.getGeometry());
            const index = polygons.findIndex((polygon) => polygon.intersectsCoordinate(coordinate));
            if (index === -1) {
                return true;
            }
            if (polygons.length < 2) {
                $.notify(Mapbender.trans('mb.advanced_digitizer.part.last_part'), 'info');
                return false;
            }
            const remaining = polygons
                .filter((polygon, i) => i !== index)
                .map((polygon) => polygon.getCoordinates());
            feature.setGeometry(new ol.geom.MultiPolygon(remaining));
            feature.set('dirty', true);
            return false;
        }
    }

    Mapbender.AdvancedDigitizer.RemovePartInteraction = RemovePartInteraction;
})();
