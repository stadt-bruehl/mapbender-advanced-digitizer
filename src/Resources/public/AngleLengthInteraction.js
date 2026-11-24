(function() {
    "use strict";
    window.Mapbender = window.Mapbender || {};
    window.Mapbender.AdvancedDigitizer = Mapbender.AdvancedDigitizer || {};

    const DEG = Math.PI / 180;
    const WEB_MERCATOR = ['EPSG:3857', 'EPSG:900913', 'EPSG:102100', 'EPSG:102113'];
    const HANDLED_EVENTS = ['pointermove', 'pointerdown', 'pointerup', 'click', 'singleclick', 'dblclick'];
    const INPUT_CHAR = /^[0-9.,<-]$/;
    const LENGTH_PATTERN = /^\d*\.?\d+$/;
    const ANGLE_PATTERN = /^-?\d*\.?\d+$/;

    function normalizeRad(a) {
        a = a % (2 * Math.PI);
        if (a <= -Math.PI) {
            a += 2 * Math.PI;
        } else if (a > Math.PI) {
            a -= 2 * Math.PI;
        }
        return a;
    }

    function normalizeDeg360(d) {
        return ((d % 360) + 360) % 360;
    }

    function isEditableTarget(target) {
        if (!target) {
            return false;
        }
        const tag = (target.tagName || '').toUpperCase();
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target.isContentEditable;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, function(c) {
            return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
        });
    }

    function notify(message) {
        if ($ && $.notify) {
            $.notify(message, 'info');
        }
    }

    /**
     * Pre-processes map browser events for an ol.interaction.Draw (LineString / Polygon):
     * angle snapping, keyboard length/angle input, live measurement tooltip.
     *
     * Must be positioned in the map's interaction collection directly after the Draw
     * interaction (= handled before Draw) and before ol.interaction.Snap (= handled after Snap),
     * so object snapping takes precedence over angle snapping.
     *
     * Angles internally: radians, mathematical convention (from x-axis, counter-clockwise),
     * evaluated in the calculation CRS.
     */
    class AngleLengthInteraction extends ol.interaction.Interaction {
        constructor(options) {
            super();
            this.options_ = Object.assign({}, AngleLengthInteraction.defaults, options || {});
            this.snapEnabled_ = !!this.options_.angleSnapEnabled;
            this.relative_ = this.options_.angleMode === 'relative';
            this.draw_ = null;
            this.sketch_ = null;
            this.buffer_ = '';
            this.lastCoordinate_ = null;
            this.lastSnapped_ = false;
            this.calcWarningShown_ = false;

            this.tooltipEl_ = document.createElement('div');
            this.tooltipEl_.className = 'mb-advdig-tooltip';
            this.overlay_ = new ol.Overlay({
                element: this.tooltipEl_,
                offset: [16, 16],
                positioning: 'top-left',
                stopEvent: false
            });

            this.keyHandler_ = this.handleKey_.bind(this);
            this.onDrawStart_ = (evt) => {
                this.sketch_ = evt.feature;
                this.buffer_ = '';
            };
            this.onDrawStop_ = () => this.reset_();
            this.onDrawActive_ = () => {
                if (this.draw_ && !this.draw_.getActive()) {
                    this.reset_();
                }
            };
        }

        setMap(map) {
            const oldMap = this.getMap();
            if (oldMap && oldMap !== map) {
                oldMap.removeOverlay(this.overlay_);
            }
            super.setMap(map);
            if (map && oldMap !== map) {
                map.addOverlay(this.overlay_);
            }
        }

        /**
         * @param {ol.interaction.Draw|null} draw
         */
        setDraw(draw) {
            draw = draw || null;
            if (draw === this.draw_) {
                return;
            }
            if (this.draw_) {
                this.draw_.un('drawstart', this.onDrawStart_);
                this.draw_.un(['drawend', 'drawabort'], this.onDrawStop_);
                this.draw_.un('change:active', this.onDrawActive_);
                document.removeEventListener('keydown', this.keyHandler_, true);
            }
            this.reset_();
            this.draw_ = draw;
            if (draw) {
                draw.on('drawstart', this.onDrawStart_);
                draw.on(['drawend', 'drawabort'], this.onDrawStop_);
                draw.on('change:active', this.onDrawActive_);
                // capture phase: runs before the Digitizer's Escape handler and before map keyboard interactions
                document.addEventListener('keydown', this.keyHandler_, true);
            }
        }

        reset_() {
            this.sketch_ = null;
            this.buffer_ = '';
            this.lastCoordinate_ = null;
            this.lastSnapped_ = false;
            this.overlay_.setPosition(undefined);
        }

        isOperational_() {
            return this.getActive() && this.draw_ && this.draw_.getActive();
        }

        /**
         * Fixed (clicked) vertices of the current sketch in map CRS, without the vertex following the pointer.
         * @return {Array<Array<number>>|null}
         */
        getFixedVertices_() {
            const geometry = this.sketch_ && this.sketch_.getGeometry();
            if (!geometry) {
                return null;
            }
            let vertices;
            switch (geometry.getType()) {
                case 'LineString':
                    vertices = geometry.getCoordinates().slice(0, -1);
                    break;
                case 'Polygon':
                    // ring = [fixed..., pointer, first]
                    vertices = (geometry.getCoordinates()[0] || []).slice(0, -2);
                    break;
                default:
                    return null;
            }
            return vertices.length ? vertices : null;
        }

        isPolygon_() {
            const geometry = this.sketch_ && this.sketch_.getGeometry();
            return !!geometry && geometry.getType() === 'Polygon';
        }

        /**
         * @param {ol.Map} map
         * @return {{toCalc: function, fromCalc: function}}
         */
        createContext_(map) {
            const mapProj = map.getView().getProjection();
            let calcProj = mapProj;
            const isMetric = mapProj.getUnits() === 'm' && WEB_MERCATOR.indexOf(mapProj.getCode()) === -1;
            if (!(this.options_.useMapSrsIfMetric && isMetric)) {
                const configured = this.options_.calcSrs && ol.proj.get(this.options_.calcSrs);
                if (configured) {
                    calcProj = configured;
                } else if (!this.calcWarningShown_) {
                    console.warn('AdvancedDigitizer: calcSrs not available, measuring in map CRS', this.options_.calcSrs, mapProj.getCode());
                    this.calcWarningShown_ = true;
                }
            }
            if (ol.proj.equivalent(mapProj, calcProj)) {
                return {
                    toCalc: (c) => [c[0], c[1]],
                    fromCalc: (c) => [c[0], c[1]]
                };
            }
            return {
                toCalc: (c) => ol.proj.transform([c[0], c[1]], mapProj, calcProj),
                fromCalc: (c) => ol.proj.transform([c[0], c[1]], calcProj, mapProj)
            };
        }

        /**
         * Direction of the segment preceding the last fixed vertex, or null.
         * @return {number|null}
         */
        getPreviousDirection_(ctx, fixed) {
            if (fixed.length < 2) {
                return null;
            }
            const a = ctx.toCalc(fixed[fixed.length - 2]);
            const b = ctx.toCalc(fixed[fixed.length - 1]);
            if (a[0] === b[0] && a[1] === b[1]) {
                return null;
            }
            return Math.atan2(b[1] - a[1], b[0] - a[0]);
        }

        getAbsoluteBase_() {
            return this.options_.angleReference === 'east' ? 0 : Math.PI / 2;
        }

        getSnapBase_(ctx, fixed) {
            if (this.relative_) {
                const previous = this.getPreviousDirection_(ctx, fixed);
                if (previous !== null) {
                    return previous;
                }
            }
            return this.getAbsoluteBase_();
        }

        /**
         * @return {Array<number>|null} snapped coordinate in map CRS, or null if outside tolerance
         */
        snapCoordinate_(ctx, fixed, coordinate) {
            const step = this.options_.angleStep * DEG;
            const tolerance = this.options_.angleTolerance * DEG;
            if (!(step > 0) || !(tolerance > 0)) {
                return null;
            }
            const origin = ctx.toCalc(fixed[fixed.length - 1]);
            const current = ctx.toCalc(coordinate);
            const dx = current[0] - origin[0];
            const dy = current[1] - origin[1];
            if (!dx && !dy) {
                return null;
            }
            const theta = Math.atan2(dy, dx);
            const base = this.getSnapBase_(ctx, fixed);
            const snappedTheta = base + Math.round(normalizeRad(theta - base) / step) * step;
            if (Math.abs(normalizeRad(theta - snappedTheta)) > tolerance) {
                return null;
            }
            const cos = Math.cos(snappedTheta);
            const sin = Math.sin(snappedTheta);
            const distance = dx * cos + dy * sin;
            return ctx.fromCalc([origin[0] + distance * cos, origin[1] + distance * sin]);
        }

        /**
         * Pointer near a vertex where Draw would finish the sketch: no angle snapping,
         * otherwise Draw's finish detection (pixel distance) could fail.
         */
        isNearFinish_(map, pixel, fixed) {
            const candidates = [fixed[fixed.length - 1]];
            if (this.isPolygon_()) {
                candidates.push(fixed[0]);
            }
            const tolerance = this.options_.finishTolerance;
            for (let i = 0; i < candidates.length; ++i) {
                const p = map.getPixelFromCoordinate(candidates[i]);
                if (p && Math.hypot(p[0] - pixel[0], p[1] - pixel[1]) <= tolerance) {
                    return true;
                }
            }
            return false;
        }

        handleEvent(evt) {
            if (!this.isOperational_() || HANDLED_EVENTS.indexOf(evt.type) === -1) {
                return true;
            }
            const fixed = this.getFixedVertices_();
            if (!fixed) {
                return true;
            }
            const map = evt.map;
            const ctx = this.createContext_(map);
            const rawPixel = evt.originalEvent ? map.getEventPixel(evt.originalEvent) : evt.pixel;
            // ol.interaction.Snap (handled before this interaction) has already replaced evt.pixel
            const objectSnapped = Math.hypot(rawPixel[0] - evt.pixel[0], rawPixel[1] - evt.pixel[1]) > 0.5;

            let coordinate = evt.coordinate;
            let snapped = false;
            if (this.snapEnabled_ && !objectSnapped && !this.isNearFinish_(map, rawPixel, fixed)) {
                const result = this.snapCoordinate_(ctx, fixed, coordinate);
                if (result) {
                    coordinate = result;
                    snapped = true;
                    evt.coordinate = coordinate;
                    evt.pixel = map.getPixelFromCoordinate(coordinate);
                }
            }
            this.lastCoordinate_ = coordinate;
            this.lastSnapped_ = snapped;
            if (evt.type === 'pointermove') {
                this.updateTooltip_(ctx, fixed, coordinate);
            }
            return true;
        }

        formatNumber_(value) {
            const decimals = this.options_.decimals;
            const locale = document.documentElement.lang || undefined;
            return value.toLocaleString(locale, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        }

        formatAngle_(theta, previous) {
            const north = this.options_.angleReference !== 'east';
            if (this.relative_ && previous !== null) {
                let delta = normalizeRad(theta - previous) / DEG;
                if (north) {
                    delta = -delta;
                }
                const sign = delta > 0 ? '+' : '';
                return sign + this.formatNumber_(delta) + '° ' + Mapbender.trans('mb.advanced_digitizer.relative');
            }
            const deg = north ? normalizeDeg360(90 - theta / DEG) : normalizeDeg360(theta / DEG);
            return this.formatNumber_(deg) + '° ' + Mapbender.trans('mb.advanced_digitizer.absolute');
        }

        updateTooltip_(ctx, fixed, coordinate) {
            const calcFixed = fixed.map(ctx.toCalc);
            const current = ctx.toCalc(coordinate);
            const origin = calcFixed[calcFixed.length - 1];
            const segment = Math.hypot(current[0] - origin[0], current[1] - origin[1]);
            let total = segment;
            for (let i = 1; i < calcFixed.length; ++i) {
                total += Math.hypot(calcFixed[i][0] - calcFixed[i - 1][0], calcFixed[i][1] - calcFixed[i - 1][1]);
            }
            const polygon = this.isPolygon_();
            if (polygon && calcFixed.length >= 2) {
                total += Math.hypot(current[0] - calcFixed[0][0], current[1] - calcFixed[0][1]);
            }
            const unit = ' ' + this.options_.unit;
            const lines = [
                Mapbender.trans('mb.advanced_digitizer.segment') + ': ' + this.formatNumber_(segment) + unit,
                Mapbender.trans(polygon ? 'mb.advanced_digitizer.perimeter' : 'mb.advanced_digitizer.total') + ': ' + this.formatNumber_(total) + unit
            ];
            if (segment > 0) {
                const theta = Math.atan2(current[1] - origin[1], current[0] - origin[0]);
                const previous = this.getPreviousDirection_(ctx, fixed);
                const angleText = escapeHtml(Mapbender.trans('mb.advanced_digitizer.angle') + ': ' + this.formatAngle_(theta, previous));
                lines.push(this.lastSnapped_ ? '<span class="mb-advdig-snapped">' + angleText + ' ✓</span>' : angleText);
            }
            const stepText = this.formatNumber_(this.options_.angleStep) + '° ' + Mapbender.trans(this.relative_ ? 'mb.advanced_digitizer.relative' : 'mb.advanced_digitizer.absolute');
            lines.push(this.snapEnabled_
                ? escapeHtml(Mapbender.trans('mb.advanced_digitizer.snap_on') + ' (' + stepText + ')')
                : '<span class="mb-advdig-off">' + escapeHtml(Mapbender.trans('mb.advanced_digitizer.snap_off')) + '</span>'
            );
            if (this.buffer_) {
                lines.push('<span class="mb-advdig-input">' + escapeHtml(Mapbender.trans('mb.advanced_digitizer.input') + ': ' + this.buffer_) + '▏</span>');
            }
            this.tooltipEl_.innerHTML = lines.map((l, i) => i < 2 ? escapeHtml(l) : l).join('<br>');
            this.overlay_.setPosition(coordinate);
        }

        refreshTooltip_() {
            const fixed = this.getFixedVertices_();
            const map = this.getMap();
            if (fixed && map && this.lastCoordinate_) {
                this.updateTooltip_(this.createContext_(map), fixed, this.lastCoordinate_);
            }
        }

        handleKey_(evt) {
            if (!this.isOperational_() || isEditableTarget(evt.target) || evt.ctrlKey || evt.altKey || evt.metaKey) {
                return;
            }
            const consume = () => {
                evt.preventDefault();
                evt.stopImmediatePropagation();
            };
            if (evt.key === this.options_.toggleKey) {
                consume();
                this.snapEnabled_ = !this.snapEnabled_;
                notify(Mapbender.trans(this.snapEnabled_ ? 'mb.advanced_digitizer.snap_on' : 'mb.advanced_digitizer.snap_off'));
                this.refreshTooltip_();
                return;
            }
            if (evt.key === this.options_.modeKey) {
                consume();
                this.relative_ = !this.relative_;
                notify(Mapbender.trans(this.relative_ ? 'mb.advanced_digitizer.mode_relative' : 'mb.advanced_digitizer.mode_absolute'));
                this.refreshTooltip_();
                return;
            }
            if (!this.getFixedVertices_()) {
                return;
            }
            if (INPUT_CHAR.test(evt.key)) {
                consume();
                this.buffer_ += evt.key;
            } else if (evt.key === 'Backspace' && this.buffer_) {
                consume();
                this.buffer_ = this.buffer_.slice(0, -1);
            } else if (evt.key === 'Escape' && this.buffer_) {
                // clear input only; do not let the Digitizer cancel the tool
                consume();
                this.buffer_ = '';
            } else if (evt.key === 'Enter' && this.buffer_) {
                consume();
                this.applyInput_();
            } else {
                return;
            }
            this.refreshTooltip_();
        }

        /**
         * "L" or "L<α"; comma or dot as decimal separator.
         * @return {{length: number, angle: number|null}|null}
         */
        parseInput_(text) {
            const parts = text.replace(/,/g, '.').split('<');
            if (parts.length > 2 || !LENGTH_PATTERN.test(parts[0])) {
                return null;
            }
            const length = parseFloat(parts[0]);
            if (!(length > 0)) {
                return null;
            }
            let angle = null;
            if (parts.length === 2) {
                if (!ANGLE_PATTERN.test(parts[1])) {
                    return null;
                }
                angle = parseFloat(parts[1]);
            }
            return {length: length, angle: angle};
        }

        /**
         * Converts a user-entered angle (degrees, configured convention / mode) to internal radians.
         */
        angleFromInput_(angleDeg, ctx, fixed) {
            const north = this.options_.angleReference !== 'east';
            const previous = this.relative_ ? this.getPreviousDirection_(ctx, fixed) : null;
            if (previous !== null) {
                return previous + (north ? -angleDeg : angleDeg) * DEG;
            }
            return north ? (90 - angleDeg) * DEG : angleDeg * DEG;
        }

        applyInput_() {
            const parsed = this.parseInput_(this.buffer_);
            if (!parsed) {
                notify(Mapbender.trans('mb.advanced_digitizer.invalid_input'));
                return;
            }
            const fixed = this.getFixedVertices_();
            const map = this.getMap();
            const ctx = this.createContext_(map);
            const origin = ctx.toCalc(fixed[fixed.length - 1]);
            let theta;
            if (parsed.angle !== null) {
                theta = this.angleFromInput_(parsed.angle, ctx, fixed);
            } else {
                const current = this.lastCoordinate_ && ctx.toCalc(this.lastCoordinate_);
                if (!current || (current[0] === origin[0] && current[1] === origin[1])) {
                    notify(Mapbender.trans('mb.advanced_digitizer.no_direction'));
                    return;
                }
                theta = Math.atan2(current[1] - origin[1], current[0] - origin[0]);
            }
            const target = ctx.fromCalc([
                origin[0] + parsed.length * Math.cos(theta),
                origin[1] + parsed.length * Math.sin(theta)
            ]);
            this.buffer_ = '';
            this.draw_.appendCoordinates([target]);
            this.lastCoordinate_ = target;
            this.lastSnapped_ = false;
        }
    }

    AngleLengthInteraction.defaults = {
        angleSnapEnabled: true,
        angleStep: 15,
        angleTolerance: 5,
        angleMode: 'absolute',
        angleReference: 'north',
        toggleKey: 'F8',
        modeKey: 'F9',
        calcSrs: 'EPSG:25832',
        useMapSrsIfMetric: true,
        decimals: 2,
        unit: 'm',
        finishTolerance: 12
    };

    Mapbender.AdvancedDigitizer.AngleLengthInteraction = AngleLengthInteraction;
})();
