// Alex Appel, Yash Thacker
// Final Project CSE 204
// 12/17/18
// Some basic code used from Spotify Web and Player API Quick Start Guides

(function() {
    /**
    * Obtains parameters from the hash of the URL
    * @return Object
    */
    function getHashParams() {
        var hashParams = {};
        var e, r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.hash.substring(1);
        while ( e = r.exec(q)) {
            hashParams[e[1]] = decodeURIComponent(e[2]);
        }
        return hashParams;
    }

    var userProfileSource = document.getElementById('user-profile-template').innerHTML,
    userProfileTemplate = Handlebars.compile(userProfileSource),
    userProfilePlaceholder = document.getElementById('user-profile');

    var oauthSource = document.getElementById('oauth-template').innerHTML,
    oauthTemplate = Handlebars.compile(oauthSource),
    oauthPlaceholder = document.getElementById('oauth');

    var params = getHashParams();

    var access_token = params.access_token,
    refresh_token = params.refresh_token,
    error = params.error;

    var our_device_id;

    if (error) {
        alert('There was an error during the authentication: ' + error);
    } else {
        if (access_token) {
            // render oauth info
            oauthPlaceholder.innerHTML = oauthTemplate({
                access_token: access_token,
                refresh_token: refresh_token
            });

            $.ajax({
                url: 'https://api.spotify.com/v1/me',
                headers: {
                    'Authorization': 'Bearer ' + access_token
                },
                success: function(response) {
                    userProfilePlaceholder.innerHTML = userProfileTemplate(response);

                    $('#login').hide();
                    $('#loggedin').show();
                    document.location.hash = "";
                }
            });
        } else {
            // render initial screen
            $('#login').show();
            $('#loggedin').hide();
        }

        document.getElementById('obtain-new-token').addEventListener('click', function() {
            console.log("inside obtain-new-token");
            $.ajax({
                url: '/refresh_token',
                data: {
                    'refresh_token': refresh_token
                }
            }).done(function(data) {
                access_token = data.access_token;
                oauthPlaceholder.innerHTML = oauthTemplate({
                    access_token: access_token,
                    refresh_token: refresh_token
                });
            });
        }, false);

        // Play a specified track on the Web Playback SDK's device ID
        function play(device_id, track_id) {
            console.log("we are in play");
            const token = access_token;
            $.ajax({
                url: "https://api.spotify.com/v1/me/player/play?device_id=" + device_id,
                type: "PUT",
                data: '{"uris": ["spotify:track:' + track_id + '"]}',
                beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + token );},
                success: function(data) {
                    console.log(data)
                }
            });
        }

        window.onSpotifyWebPlaybackSDKReady = () => {
            const token = access_token;
            const player = new Spotify.Player({
                name: "Insta Jam",
                getOAuthToken: cb => { cb(token); }
            });
            window.player = player;

            // Error handling
            player.addListener('initialization_error', ({ message }) => { console.error(message); });
            player.addListener('authentication_error', ({ message }) => { console.error(message); });
            player.addListener('account_error', ({ message }) => { console.error(message); });
            player.addListener('playback_error', ({ message }) => { console.error(message); });

            // Playback status updates
            player.addListener('player_state_changed', state => { console.log(state); });

            // Ready
            player.addListener('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);

                our_device_id = device_id;

                play(device_id);
            });

            // Not Ready
            player.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
            });

            player.getCurrentState().then(state => {
                if (!state) {
                    console.error('User is not playing music through the Web Playback SDK');
                    return;
                }

                let {
                    current_track,
                    next_tracks: [next_track]
                } = state.track_window;
                console.log('Currently Playing', current_track);
                console.log('Playing Next', next_track);
            });

            // Connect to the player!
            player.connect();
        };


        var resultsList = document.getElementById("resultsList");

        // Handle new search form submit
        document.getElementById("searchBox").addEventListener("submit", function(event) {
            console.log("inside 1");
            console.log("searched for: " + newSearch.value);
            event.preventDefault();

            // Empty list of results before populating with new results
            document.getElementById('resultsList').innerHTML = '';

            $.ajax({
                url: 'https://api.spotify.com/v1/search?q=' + newSearch.value + '&type=track&market=US&limit=10',
                type: 'GET',
                headers: {
                    'Authorization' : 'Bearer ' + access_token
                },
                success: function(data) {
                    console.log("call successful");
                    console.log("token: " + access_token);

                    // Parse response for tracks
                    console.log("_______________________");
                    console.log("Here are the tracks:");
                    for (var i = 0; i < data.tracks.items.length; i++) {
                        let item = data.tracks.items[i];
                        console.log(item.name);

                        // Populate list of results
                        let entry = document.createElement("li");
                        entry.appendChild(document.createTextNode("Track: " + item.name));

                        console.log("id: " + item.id);

                        // Add onclick listener to play selected track
                        entry.onclick = function() {
                            alert("About to play: " + item.name);
                            play(our_device_id, item.id);
                        };

                        resultsList.appendChild(entry);
                    }

                },
                error: function(data) {
                    console.log("some error");
                }
            });
        });
    }
})();
