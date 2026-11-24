(function() {
    "use strict";
    window.Mapbender.AdvancedDigitizer = Mapbender.AdvancedDigitizer || {};

    const ADD_PART = 'addPart';
    const REMOVE_PART = 'removePart';
    const PART_TOOLS = [ADD_PART, REMOVE_PART];

    class AdvancedToolset extends Mapbender.Digitizer.Toolset {
        constructor(owner) {
            super(owner);
            Object.assign(this.iconMap_, {
                [ADD_PART]: 'icon-draw-polygon mb-advdig-part-add',
                [REMOVE_PART]: 'icon-draw-polygon mb-advdig-part-remove'
            });
        }

        getValidToolNames(schema) {
            const names = super.getValidToolNames(schema);
            return schema.featureType.geomType === 'multipolygon' ? names.concat(PART_TOOLS) : names;
        }

        normalizeToolSet_(schema) {
            return super.normalizeToolSet_(schema).map(function(toolSpec) {
                if (!toolSpec.label && PART_TOOLS.indexOf(toolSpec.type) !== -1) {
                    toolSpec.label = 'mb.advanced_digitizer.toolset.' + toolSpec.type;
                }
                return toolSpec;
            });
        }

        checkToolAccess_(schema, toolName) {
            if (PART_TOOLS.indexOf(toolName) !== -1) {
                return !!(schema.allowEdit && schema.allowDigitize);
            }
            return super.checkToolAccess_(schema, toolName);
        }
    }

    Object.assign(Mapbender.AdvancedDigitizer, {
        ADD_PART: ADD_PART,
        REMOVE_PART: REMOVE_PART,
        PART_TOOLS: PART_TOOLS,
        AdvancedToolset: AdvancedToolset
    });
})();
