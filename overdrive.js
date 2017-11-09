const fs = require('fs');
const b64ContentPattern = /(<body><script type="text\/javascript">parent\.__bif_cfc0\(self,'(.*?)'\)<\/script><\/body>)/gim ; 
const baseRefPattern = /<base href=.*?>/img;
const xhtml = /(\.xhtml)/img;
var command = process.argv[2];
if ( process.argv[2] == undefined )  {
  console.log('download or decode ?\n');
  process.exit();
} 

if (command == "download" ) {
  let input_file = process.argv[3] ,
    base_url = process.argv[4];  
  if (input_file == undefined || base_url == undefined ) {
    console.log ('manifest & baseUrl ?');
    process.exit();
  } 
  createDownloadIndex(input_file, base_url);
}

if (command == "decode") {
  let input_path = process.argv[3];
  if (input_path == undefined) {
    console.log ('dir ?');
    process.exit();    
  }
  readDir(input_path)
  .then(renameHtmlFiles)
  .then(files=>files.filter(file=> file.endsWith('.html')))
  .then(files => files.map(file => decode(file).then(content => fs.writeFile(file, content, "utf8")) )) 
}

function decode(input_file) {
  return read_data(input_file)
  .then(data=>searchAndReplace(data, [b64ContentPattern] , [ (p,m,t)=>t.replace(p, new Buffer(m[2], 'base64').toString('utf8') )]))
  .then(data=>searchAndReplace(data, [baseRefPattern] , [ (p,m,t)=>t.replace(p, '' )]))
  .then(data=>searchAndReplace(data, [xhtml] , [ (p,m,t)=>t.replace(p, '.html' )]));
}

function readDir(input_path) {
  return new Promise((resolve, reject)=>{
    fs.readdir(input_path, (error, files) => {
      if (error) {
        console.log(error);
        reject("");
      } else {
        resolve(files.map( file => input_path + '/' + file ));
      }
    }); 
  })
}

function renameHtmlFiles(files) {
    let old_paths = files
      .filter(file => file.endsWith('.htm') || file.endsWith('.xhtml') );
    let new_paths = old_paths
      .map( file => file.slice(0, file.lastIndexOf('.')) + '.html' );
    let pairs = zip (old_paths, new_paths) ;   
    pairs.map(([old_path, new_path])=> fs.rename( old_path, new_path ) )  
    return files.filter(file => file.endsWith('.html')).concat(new_paths);
}

function zip(array1, array2) {
  return array1.reduce((a,b,i)=>{a.push([b, array2[i]]);return a},[]);
}

function searchAndReplace(text, patterns, replacers) {
  // assert(patterns.length == replacers.length);
  let pairs = zip( patterns, replacers);
  return pairs.reduce((replaced, [pattern, replacer])=>{
    let matches = pattern.exec(replaced);
    if (matches == null)    
       return replaced;
    return replacer(pattern, matches, replaced);
  }, text);
}

function createDownloadIndex(input_file, base_url) {
  return read_data(input_file)
  .then(data => generateBookLinks(base_url, data))
  .then(links => '<ol>' + links.map(link => '<li>' + link + '</li>\r\n').join('\r\n') + '</ol>' )
  .then(data => {write_file('download.html', data); return data }) ;
}

function generateBookLinks(base_url, data) {
  let links = data
    .replace(/$/gim, '\n')
    .split("\n")
    .filter(line => line.startsWith("/"))
    .map(line => {
      let s = line.lastIndexOf('/'),
          q = line.lastIndexOf('?'),
          fn = line.slice(s + 1, (q > 0 ? q : line.length));
      return `<a href="${base_url}${line}" download="${fn}" onclick="this.style.color='grey';">${fn}</a>`;
    });

  if (links.length == 0) 
    console.log("No links generated!");

  return links;
}

function write_file(file_name, data) {
  fs.writeFile(file_name, data)
}

function read_data(file_name) {
  return (new Promise((resolve, reject)=>{
    fs.readFile(file_name, "utf8",(error, content)=>{
      if (error) {
        console.log(error);
        reject("");
      } else {
        resolve(content);
      }
    }); 
  }));
}
