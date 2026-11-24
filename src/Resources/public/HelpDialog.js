(function() {
    "use strict";
    window.Mapbender.AdvancedDigitizer = Mapbender.AdvancedDigitizer || {};

    const {ADD_PART, REMOVE_PART} = Mapbender.AdvancedDigitizer;
    const PREFIX = 'mb.advanced_digitizer.help.';
    const ANGLE_LENGTH_TOOLS = ['drawLine', 'drawPolygon', ADD_PART];

    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, function(c) {
            return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
        });
    }

    function kbd(text) {
        return '<kbd>' + escapeHtml(text) + '</kbd>';
    }

    function number(value) {
        return escapeHtml(Number(value).toLocaleString(document.documentElement.lang || undefined));
    }

    /**
     * Escaped translation; %name% placeholders are replaced by the given values, which must already be safe HTML.
     */
    function html(key, params) {
        let result = escapeHtml(Mapbender.trans(PREFIX + key));
        Object.keys(params || {}).forEach(function(name) {
            result = result.split('%' + name + '%').join(params[name]);
        });
        return result;
    }

    class HelpDialog {
        /**
         * @param {Object} drawingOptions
         */
        constructor(drawingOptions) {
            this.options_ = drawingOptions;
            this.popup_ = null;
        }

        /**
         * @param {Array<String>} toolNames tools offered in the current schema
         */
        open(toolNames) {
            const $content = this.render_(toolNames);
            if (this.popup_) {
                this.popup_.setContent($content);
                this.popup_.open();
                return;
            }
            this.popup_ = new Mapbender.Popup({
                title: Mapbender.trans(PREFIX + 'title'),
                cssClass: 'mb-advdig-help',
                content: $content,
                modal: false,
                draggable: true,
                resizable: true,
                closeOnESC: false,
                width: 520,
                buttons: []
            });
        }

        /**
         * @param {Array<String>} toolNames
         */
        refresh(toolNames) {
            if (this.isOpen_()) {
                this.popup_.setContent(this.render_(toolNames));
            }
        }

        close() {
            if (this.isOpen_()) {
                this.popup_.close();
            }
        }

        isOpen_() {
            return !!(this.popup_ && this.popup_.$element && $.contains(document, this.popup_.$element.get(0)));
        }

        render_(toolNames) {
            const offers = (names) => names.some((name) => toolNames.indexOf(name) !== -1);
            const options = this.options_;
            const escapeKey = kbd('Esc');
            const sections = [];
            if (offers(ANGLE_LENGTH_TOOLS)) {
                const unit = escapeHtml(options.unit);
                sections.push(['drawing', [
                    html('drawing.vertices'),
                    html('drawing.tooltip'),
                    html('drawing.object_snap')
                ]]);
                sections.push(['angle', [
                    html('angle.snap', {step: number(options.angleStep), tolerance: number(options.angleTolerance)}),
                    html('angle.toggle', {key: kbd(options.toggleKey)}),
                    html('angle.mode', {key: kbd(options.modeKey)}),
                    html(options.angleReference === 'east' ? 'angle.reference_east' : 'angle.reference_north')
                ]]);
                sections.push(['input', [
                    html('input.length', {enter: kbd('Enter'), unit: unit}),
                    html('input.angle', {unit: unit}),
                    html('input.edit', {backspace: kbd('Backspace'), escape: escapeKey})
                ]]);
            }
            if (offers([ADD_PART, REMOVE_PART])) {
                const items = [];
                if (offers([ADD_PART])) {
                    items.push(html('parts.add'), html('parts.escape', {escape: escapeKey}));
                }
                if (offers([REMOVE_PART])) {
                    items.push(html('parts.remove'));
                }
                items.push(html('parts.valid'));
                sections.push(['parts', items]);
            }
            if (toolNames.length) {
                sections.push(['finish', [
                    html('finish.escape', {escape: escapeKey}),
                    html('finish.save'),
                    html('finish.revert')
                ]]);
            }

            const $content = $('<div>');
            if (!sections.length) {
                return $content.append($('<p>').html(html('no_tools')));
            }
            sections.forEach(function([name, items]) {
                $content.append($('<h4>').html(html(name + '.title')));
                $content.append($('<ul>').append(items.map((item) => $('<li>').html(item).get(0))));
            });
            return $content;
        }
    }

    Mapbender.AdvancedDigitizer.HelpDialog = HelpDialog;
})();
