// var resultsList = document.getElementById("resultsList");

// // Handle new search form submit
// document.getElementById("searchBox").addEventListener("submit", function(event) {
//  console.log("inside 1");
//  console.log("searched for: " + newSearch.value);
//  event.preventDefault();
//  var accessToken = "BQDGfjIpj_J5MQE72g_8zkDtsWucnLrMBWSdkXnzXLeBBmb28nHcHupDIqKZH7i-ofwi4UhjFoH8RzN7uMXQt8iqqorquV6jTVAgFOl3DC2pz1R-7RBTLu3ONjBkoyoRrkwuUbWc0F9d3grO3fpZOBWvlM4JDC91bWqrTmrI";
    
//  // Empty list of results before populating with new results
//  document.getElementById('resultsList').innerHTML = '';

//  $.ajax({
//      url: 'https://api.spotify.com/v1/search?q=' + newSearch.value + '&type=track%2Cartist&market=US&limit=10',
//      type: 'GET',
//      headers: {
//          'Authorization' : 'Bearer ' + accessToken
//      },
//      success: function(data) {
//          console.log("call successful");

//          // Parse response for artists
//          console.log("_______________________");
//          console.log("Here are the artists:");
//          for (var i = 0; i < data.artists.items.length; i++) {
//              var item = data.artists.items[i];
//              console.log(item.name);

//              // Populate list of results
//              var entry = document.createElement("li");
//              entry.appendChild(document.createTextNode("Artist: " + item.name));
//              resultsList.appendChild(entry);
//          }

//          // Parse response for tracks
//          console.log("_______________________");
//          console.log("Here are the tracks:");
//          for (var i = 0; i < data.tracks.items.length; i++) {
//              var item = data.tracks.items[i];
//              console.log(item.name);

//              // Populate list of results
//              var entry = document.createElement("li");
//              entry.appendChild(document.createTextNode("Track: " + item.name));
//              resultsList.appendChild(entry);
//          }
            
//      },
//      error: function(data) {
//          console.log("some error");
//      }
//  });
// });




var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

var client_id = '5242bc5b2e3f4cacaee83c8aaa75020d'; // Your client id
var client_secret = 'cec8710517cf44dbb6e69940d22b36c1'; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          console.log(body);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

console.log('Listening on 8888');
app.listen(8888);


