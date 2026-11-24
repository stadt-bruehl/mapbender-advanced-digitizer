(function() {
    "use strict";
    window.Mapbender.AdvancedDigitizer = Mapbender.AdvancedDigitizer || {};

    const {ADD_PART, PART_TOOLS} = Mapbender.AdvancedDigitizer;
    const SUPPORTED_TOOLS = ['drawLine', 'drawPolygon', ADD_PART];

    class AdvancedFeatureEditor extends Mapbender.Digitizer.FeatureEditor {
        /**
         * @param {*} owner
         * @param {ol.Map} olMap
         * @param {Object} drawingOptions
         */
        constructor(owner, olMap, drawingOptions) {
            super(owner, olMap);
            this.angleLength_ = new Mapbender.AdvancedDigitizer.AngleLengthInteraction(drawingOptions);
            this.partTools_ = {};
            this.partTarget_ = null;
            this.partSketching_ = false;
        }

        toggleTool(toolName, schema, state) {
            super.toggleTool(toolName, schema, state);
            if (!state && PART_TOOLS.indexOf(toolName) !== -1) {
                this.setPartTarget(null);
            }
            const draw = state && SUPPORTED_TOOLS.indexOf(toolName) !== -1 && this.activeInteraction || null;
            this.angleLength_.setDraw(draw);
            if (draw) {
                this.placeAfter_(draw);
            }
        }

        getDrawingTool(type, schema) {
            if (PART_TOOLS.indexOf(type) === -1) {
                return super.getDrawingTool(type, schema);
            }
            if (!this.partTools_[type]) {
                const tool = type === ADD_PART
                    ? this.createAddPartTool_()
                    : new Mapbender.AdvancedDigitizer.RemovePartInteraction(() => this.partTarget_);
                this.bindEscape_(tool);
                this.initMap_(tool);
                this.partTools_[type] = tool;
            }
            this.addSnapInteraction(schema);
            return this.partTools_[type];
        }

        /**
         * @return {ol.Feature|null}
         */
        getEditFeature() {
            return this.modifyingCollection_.item(0) || null;
        }

        /**
         * @param {ol.Feature|null} feature
         */
        setPartTarget(feature) {
            this.partTarget_ = feature || null;
            this.setEditFeature(this.partTarget_);
        }

        /**
         * Insert directly after the Draw interaction: handled before Draw, after ol.interaction.Snap
         * (Snap is re-appended at the end of the collection by addSnapInteraction).
         * @param {ol.interaction.Interaction} draw
         * @private
         */
        placeAfter_(draw) {
            const interactions = this.olMap.getInteractions();
            interactions.remove(this.angleLength_);
            interactions.insertAt(interactions.getArray().indexOf(draw) + 1, this.angleLength_);
        }

        createAddPartTool_() {
            // No source: the sketch is only appended to the target, never added as a feature of its own
            const draw = new ol.interaction.Draw({
                type: 'Polygon',
                stopClick: true,
                condition: this.leftClickOnly_
            });
            draw.on('drawstart', () => {
                this.partSketching_ = true;
            });
            draw.on(['drawend', 'drawabort'], () => {
                this.partSketching_ = false;
            });
            draw.on('drawend', (evt) => this.appendPart_(evt.feature.getGeometry()));
            return draw;
        }

        /**
         * @param {ol.geom.Polygon} polygon
         * @private
         */
        appendPart_(polygon) {
            const feature = this.partTarget_;
            if (!feature) {
                return;
            }
            const geometry = feature.getGeometry();
            const parts = geometry.getType() === 'Polygon' ? [geometry.getCoordinates()] : geometry.getCoordinates();
            parts.push(polygon.getCoordinates());
            feature.setGeometry(new ol.geom.MultiPolygon(parts));
            feature.set('dirty', true);
        }

        /**
         * Escape aborts a part sketch in progress; without one it ends the tool, like the
         * Digitizer's own tools. Bubbling phase on purpose: the capture-phase handler of
         * AngleLengthInteraction consumes Escape first while a length input is pending.
         * @param {ol.interaction.Interaction} tool
         * @private
         */
        bindEscape_(tool) {
            const onKeyDown = (evt) => {
                if (evt.key !== 'Escape') {
                    return;
                }
                if (this.partSketching_) {
                    this.partTools_[ADD_PART].abortDrawing();
                } else {
                    $('.-fn-toggle-tool[data-toolname].active', this.owner.$element).click();
                }
            };
            tool.on('change:active', () => {
                if (tool.getActive()) {
                    document.addEventListener('keydown', onKeyDown);
                } else {
                    document.removeEventListener('keydown', onKeyDown);
                }
            });
        }
    }

    Mapbender.AdvancedDigitizer.AdvancedFeatureEditor = AdvancedFeatureEditor;
})();
