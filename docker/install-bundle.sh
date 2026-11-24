#!/bin/sh
# Registers the bundle in a Mapbender Docker image (user www-data). Expects the bundle at /var/mapbender/advanced-digitizer.
# Registers autoloader and bundle, rebuilds the Symfony cache.
set -e
cd /var/mapbender/application

php -r '
$f = "composer.json";
$j = json_decode(file_get_contents($f));
$j->autoload->{"psr-4"}->{"Mapbender\\AdvancedDigitizerBundle\\"} = "../advanced-digitizer/src/";
file_put_contents($f, json_encode($j, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");

$b = "config/bundles.php";
$c = file_get_contents($b);
if (strpos($c, "MapbenderAdvancedDigitizerBundle") === false) {
    $line = "    Mapbender\\AdvancedDigitizerBundle\\MapbenderAdvancedDigitizerBundle::class => [\"all\" => true],\n";
    $c = preg_replace("/\\];\\s*\$/", $line . "];\n", $c, 1, $n);
    if ($n !== 1) { fwrite(STDERR, "bundles.php: insert failed\n"); exit(1); }
    file_put_contents($b, $c);
}
'

php bin/composer dump-autoload -o --no-scripts
php bin/console cache:clear
php bin/console debug:container mapbender.element.AdvancedDigitizer >/dev/null
echo "AdvancedDigitizer installed"
