<?php

use Illuminate\Support\Facades\Route;
use Symfony\Component\Finder\Finder;

if(!function_exists('app')) return;
if(evo()->event->name == 'OnLoadSettings') {
    $url = $url ?? '/forms';
    Route::post($url, function(){
        $formid = request()->input('formid');
        if (!request()->ajax() || empty($formid) || !is_scalar($formid)) evo()->sendErrorPage();
        $files = [];
        try {
            foreach (Finder::create()->files()->name('*.php')->in(EVO_CORE_PATH . 'custom/forms/') as $file) {
                $files[basename($file->getRealPath(), '.php')] = $file->getRealPath();
            }
        } catch (Exception $e) {
        };
        if (isset($files[$formid])) {
            evo()->invokeEvent('OnWebPageInit');
            $params = require($files[$formid]);
            $snippet = $params['snippet'] ?? 'FormLister';
            unset($params['snippet']);
            $params['api'] = $params['api'] ?? 2;
            $params['apiFormat'] = 'array';

            return evo()->runSnippet($snippet, $params);
        } else {
            evo()->sendErrorPage();
        }
    });
}
if(evo()->event->name == 'OnLoadWebDocument') {
    evo()->regClientStartupHTMLBlock('<script defer src="' . MODX_SITE_URL . 'assets/plugins/formsender/formsender.min.js"></script>');
} 
