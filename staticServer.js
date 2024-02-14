var url = require('url');
var http = require('http');
var fs = require('fs');
var path = require('path');

function trim(x){return x.trim();}


var mime={
    '.js':'application/javascript;charset=UTF-8',
    '.html':'text/html; charset=UTF-8',
    '.mp4':'video/mp4',
    '.flv':'video/x-flv',
    '.jpg':'image/jpeg',
    '.css':'text/css',
    '.tiff':'image/tiff',
    '.png':'image/png'
};

function createFollowingStream(filename) {

}


function serve(root,req,res,prefix) {

    var requestURL=url.parse(req.url,true);

    var decodedPath=decodeURI(requestURL.pathname);

    var filename=path.join(root,path.relative(prefix || '',path.join('.',decodedPath)));

    var requestHeaders={};

    Object.keys(req.headers).forEach(function(key){requestHeaders[key.toLowerCase()]=req.headers[key].trim();});

    var headers={};

    headers['Cache-Control']='max-age=60';


    function statServe(filename,stats,incomplete) {

        if (stats.isDirectory()) {

            var indexPath=path.join(filename,'index.html');
            fs.stat(indexPath,function(err,indexStats) {
                if (err) {
                    res.writeHead(403,headers);
                    res.end();
                } else {
                    if (!decodedPath.endsWith('/')) {
                        requestURL.pathname=requestURL.pathname+'/';
                        headers['Location']=url.format(requestURL);
                        res.writeHeader(301,headers);
                        res.end();
                    } else {
                        statServe(indexPath,indexStats);
                    }
                }
            });
        } else if (stats.isFile()) {
            var etag=stats.size+'-'+stats.mtime.getTime();

            if (!incomplete) {
                headers['ETag']=etag;

                var requestEtags=(requestHeaders['if-none-match'] || '').split(',').map(trim);
                if (requestEtags.contains(etag)) {
                    res.writeHead(304,headers);
                    res.end();
                    return;
                }
            }

            headers['Content-Length']=stats.size;

            var responseCode=200;


            var options={};

            if (requestHeaders['range']) {

                var permit=true;

                if (requestHeaders['if-range']) {
                    if (etag!=requestHeaders['if-range']) {
                        permit=false;
                    }
                }

                var rangeSpecifier=requestHeaders['range'].trim().split('=');
                if (permit && rangeSpecifier.length==2 && rangeSpecifier[0].trim()=='bytes') {
                    var ranges=rangeSpecifier[1].split(',').map(trim);
                    if (ranges.length==1) {
                        var startEnd=ranges[0].split('-').map(trim);
                        if (startEnd.length==2) {
                            var start=startEnd[0]=='' ? 0 : parseInt(startEnd[0]);
                            var end=startEnd[1]=='' ? stats.size-1 : parseInt(startEnd[1]);
                            options['start']=start;
                            options['end']=end;
                            responseCode=206;
                            headers['Content-Length']=end-start+1;
                            var incomplete;
                            headers['Content-Range']='bytes '+start+'-'+end+'/'+(incomplete ? '*' : stats.size);
                        }
                    }
                }
            }

            headers['Content-Type']=mime[path.extname(filename)] || 'application/octet-stream';

            if (requestURL.query && ('download' in requestURL.query)) {
                headers['Content-Disposition']='attachment; filename='+path.basename(filename);
            }

            headers['Accept-Ranges']='bytes';

            res.writeHead(responseCode,headers);



            fs.createReadStream(filename,options).pipe(res);



        } else {
            res.writeHead(404);
            res.end();
        }
    }


    fs.stat(filename,function(err,stats) {



        if (err) {
            res.writeHead(404,headers);
            res.end();
        } else {
            statServe(filename,stats,false);
        }
    });


}


exports.serve=serve;
