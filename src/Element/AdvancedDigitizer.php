<?php

namespace Mapbender\AdvancedDigitizerBundle\Element;

use Mapbender\CoreBundle\Entity\Element;
use Mapbender\DigitizerBundle\Element\Digitizer;

class AdvancedDigitizer extends Digitizer
{
    public static function getClassTitle()
    {
        return 'mb.advanced_digitizer.class.title';
    }

    public static function getClassDescription()
    {
        return 'mb.advanced_digitizer.class.description';
    }

    public function getWidgetName(Element $element)
    {
        return 'MbAdvancedDigitizer';
    }

    public static function getDefaultDrawingConfiguration(): array
    {
        return [
            'angleSnapEnabled' => true,
            'angleStep' => 15,
            'angleTolerance' => 5,
            'angleMode' => 'absolute',
            'angleReference' => 'north',
            'toggleKey' => 'F8',
            'modeKey' => 'F9',
            'calcSrs' => 'EPSG:25832',
            'useMapSrsIfMetric' => true,
            'decimals' => 2,
            'unit' => 'm',
            'finishTolerance' => 12,
        ];
    }

    public function getRequiredAssets(Element $element)
    {
        $assets = parent::getRequiredAssets($element);
        $assets['js'][] = '@MapbenderAdvancedDigitizerBundle/Resources/public/AngleLengthInteraction.js';
        $assets['js'][] = '@MapbenderAdvancedDigitizerBundle/Resources/public/RemovePartInteraction.js';
        $assets['js'][] = '@MapbenderAdvancedDigitizerBundle/Resources/public/AdvancedToolset.js';
        $assets['js'][] = '@MapbenderAdvancedDigitizerBundle/Resources/public/HelpDialog.js';
        $assets['js'][] = '@MapbenderAdvancedDigitizerBundle/Resources/public/AdvancedFeatureEditor.js';
        $assets['js'][] = '@MapbenderAdvancedDigitizerBundle/Resources/public/MbAdvancedDigitizer.js';
        $assets['css'][] = '@MapbenderAdvancedDigitizerBundle/Resources/public/sass/advanced-digitizer.scss';
        $assets['trans'][] = 'mb.advanced_digitizer.*';
        return $assets;
    }

    public function getClientConfiguration(Element $element)
    {
        $configuration = parent::getClientConfiguration($element);
        $custom = $configuration['advancedDrawing'] ?? [];
        $configuration['advancedDrawing'] = array_replace(
            static::getDefaultDrawingConfiguration(),
            \is_array($custom) ? $custom : []
        );
        return $configuration;
    }
}
