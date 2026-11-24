(function() {
    "use strict";

    const {PART_TOOLS} = Mapbender.AdvancedDigitizer;

    class MbAdvancedDigitizer extends Mapbender.Element.MbDigitizer {
        constructor(configuration, $element) {
            super(configuration, $element);
            this.pendingPartTarget_ = null;
            this.helpDialog_ = null;
        }

        _createFeatureEditor(olMap) {
            return new Mapbender.AdvancedDigitizer.AdvancedFeatureEditor(this, olMap, this.options.advancedDrawing || {});
        }

        _createToolsetRenderer() {
            return new Mapbender.AdvancedDigitizer.AdvancedToolset(this);
        }

        _initializeEvents() {
            // Bound before the Digitizer's own tool button handler: that one ends modifyFeature
            // first and thereby discards the feature selected for editing.
            const selector = PART_TOOLS
                .map((name) => '.-fn-toggle-tool[data-toolname="' + name + '"]:not(.active)')
                .join(',');
            this.$element.on('click', selector, (evt) => {
                this.pendingPartTarget_ = this.getPartTarget_();
                if (!this.pendingPartTarget_) {
                    evt.stopImmediatePropagation();
                    $.notify(Mapbender.trans('mb.advanced_digitizer.part.no_target'), 'info');
                }
            });
            this.$element.on('click', '.-fn-advdig-help', () => {
                this.getHelpDialog_().open(this.getOfferedToolNames_());
            });
            super._initializeEvents();
        }

        _openEditDialog(schema, feature) {
            const dialog = super._openEditDialog(schema, feature);
            // Digitizer 3.0.0 waits for "dialogclose", which Mapbender.Popup never triggers. Without this,
            // closing the form via its X keeps the toolbar disabled and leaves unsaved new features behind.
            this.currentPopup.$element.one('close', () => dialog.trigger('dialogclose'));
            return dialog;
        }

        _updateToolset(schema) {
            super._updateToolset(schema);
            const $button = $('<button type="button" class="-fn-advdig-help btn btn-outline-secondary">')
                .attr('title', Mapbender.trans('mb.advanced_digitizer.help.button'))
                .append('<i class="fa-solid fa-circle-question"></i>');
            $('.toolset .btn-toolbar', this.$element)
                .append($('<div class="btn-group btn-group-sm ms-2">').append($button));
            if (this.helpDialog_) {
                this.helpDialog_.refresh(this.getOfferedToolNames_());
            }
        }

        deactivate() {
            super.deactivate();
            if (this.helpDialog_) {
                this.helpDialog_.close();
            }
        }

        getHelpDialog_() {
            if (!this.helpDialog_) {
                const drawingOptions = Object.assign({}, Mapbender.AdvancedDigitizer.AngleLengthInteraction.defaults, this.options.advancedDrawing);
                this.helpDialog_ = new Mapbender.AdvancedDigitizer.HelpDialog(drawingOptions);
            }
            return this.helpDialog_;
        }

        /**
         * @return {Array<String>}
         * @private
         */
        getOfferedToolNames_() {
            return $('.-fn-toggle-tool[data-toolname]', this.$element)
                .map((i, button) => button.getAttribute('data-toolname'))
                .get();
        }

        _toggleDrawingTool(schema, toolName, state) {
            if (PART_TOOLS.indexOf(toolName) !== -1) {
                let target = null;
                if (state) {
                    target = this.pendingPartTarget_;
                    this.pendingPartTarget_ = null;
                }
                this.clearHighlightExclude_();
                if (target) {
                    this.excludedFromHighlighting_.push(target);
                }
                this.featureEditor.setPartTarget(target);
            }
            super._toggleDrawingTool(schema, toolName, state);
        }

        /**
         * @return {ol.Feature|null} saved feature of a multipolygon schema currently in modifyFeature edit mode
         * @private
         */
        getPartTarget_() {
            const feature = this.featureEditor.getEditFeature();
            const schema = feature && this._getUniqueItemId(feature) && this.getItemSchema(feature);
            if (!schema || !schema.allowEdit || !schema.allowDigitize || schema.featureType.geomType !== 'multipolygon') {
                return null;
            }
            const type = feature.getGeometry().getType();
            return type === 'Polygon' || type === 'MultiPolygon' ? feature : null;
        }
    }

    window.Mapbender.Element.MbAdvancedDigitizer = MbAdvancedDigitizer;
})();
