// Alex Appel, Yash Thacker
// Final Project CSE 204
// 12/17/18
// Some starter code used from Spotify Web and Player API Quick Start Guides


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


// Initialize Cloud Firestore through Firebase
var db = firebase.firestore();

// Disable deprecated features
db.settings({
  timestampsInSnapshots: true
});


var ID = function () {
    // Math.random should be unique because of its seeding algorithm.
    // Convert it to base 36 (numbers + letters), and grab the first 6 characters
    // after the decimal.
    return Math.random().toString(36).substr(2, 6);
};

var guest = false;


var our_device_id;

var current_track_progress = 0;

var queue = [];
var currentTrackCount = 0;

var allowNewTrigger = false;

var room_id = ID();

var firebaseDocumentReference;

var host_name;

var current_track_name;

var firstSearch = true;

var firstPlay = true;


function SongSearchInput(searchBoxQuery, newSearchQuery) {
    var songSearchInputElement = document.getElementById(searchBoxQuery);
    var newSearchElement = document.getElementById(newSearchQuery);

    this.onSubmit = function (callback) {
        songSearchInputElement.addEventListener("submit", function (event) {
            event.preventDefault();
            var search = newSearchElement.value;
            callback(search);
            newSearchElement.value = "";
        })
    }
}

function SpotifyAPI(resultsListQuery) {


    this.performSearch = function (search, callback) {
        document.getElementById(resultsListQuery).innerHTML = '';

        $.ajax({
            url: 'https://api.spotify.com/v1/search?q=' + search + '&type=track&market=US&limit=10',
            type: 'GET',
            headers: {
                'Authorization' : 'Bearer ' + access_token
            },
            success: function(data) {
                callback(data);
            },
            error: function(data) {
                console.log("Some error: " + error);
                console.log("search was: " + search);
            }
        });
    }
}

function ResultsList(resultsListQuery) {
    var resultsList = document.getElementById(resultsListQuery);

    this.setSearchResults = function (data) {
        // Parse response for tracks
        for (var i = 0; i < data.tracks.items.length; i++) {
            let item = data.tracks.items[i];

            // Populate list of results
            let entry = document.createElement("li");
            entry.appendChild(document.createTextNode("Track: " + item.name));

            // Add onclick listener to add selected track to queue
            entry.onclick = function() {
                queue.push("spotify:track:" + item.id);

                if (!guest && (current_track_progress == 0)) {
                    triggerNextTrack();
                }

                // Update Firestore
                var roomRef = db.collection("rooms").doc(firebaseDocumentReference);

                // Set the queue in Firestore to our queue
                return roomRef.update({
                    queue: queue
                })
                .then(function() {
                    console.log("Document successfully updated!");
                })
                .catch(function(error) {
                    // The document probably doesn't exist.
                    console.error("Error updating document: ", error);
                });



            };
            resultsList.appendChild(entry);
        }
    }
}

function GuestApplication() {
    var spotifyAPI = new SpotifyAPI("resultsList2");
    var songSearchInput = new SongSearchInput("searchBox2", "newSearch2");
    var resultsListView = new ResultsList("resultsList2");

    this.registerSearchListener = function () {
        songSearchInput.onSubmit(function (search) {
            spotifyAPI.performSearch(search, function (results) {
                console.log("search results:", results);
                resultsListView.setSearchResults(results);
            })
        })
    }
}

function HostApplication() {
    var spotifyAPI = new SpotifyAPI("resultsList");
    var songSearchInput = new SongSearchInput("searchBox", "newSearch");
    var resultsListView = new ResultsList("resultsList");

    this.registerSearchListener = function () {
        songSearchInput.onSubmit(function (search) {
            spotifyAPI.performSearch(search, function (results) {
                console.log("search results:", results);
                resultsListView.setSearchResults(results);
            })
        })
    }
}

var application;


document.getElementById("join_existing").addEventListener("submit", function(event) {
    event.preventDefault();

    guest = true;
    application = new GuestApplication();
    application.registerSearchListener();

    var code = document.getElementById('room_code').value;

    // Query Firestore to cross-check entered code
    db.collection("rooms").get().then(function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
            // doc.data() is never undefined for query doc snapshots

            let data = doc.data();

            if (code == data.id) {
                console.log("i get here");

                room_id = data.id;
                host_name = data.host;
                queue = data.queue;
                access_token = data.token;
                firebaseDocumentReference = doc.id;

                document.getElementById('host_name').innerHTML = "Host: " + host_name;
                document.getElementById('room_id').innerHTML = "Room Id: " + room_id;
                $('#login').hide();
                $('#guest').show();
            }
        });

    })
    .catch(function(error) {
        console.log("Error getting documents: ", error);
    });
});


function triggerNextTrack() {
    allowNewTrigger = true;
    if (queue.length > currentTrackCount) {
        play(our_device_id, queue[currentTrackCount]);
    }
}

// Play a specified track on the device id
function play(device_id, track_id) {
    $.ajax({
        url: "https://api.spotify.com/v1/me/player/play",
        type: "PUT",
        data: JSON.stringify({
            "uris": [track_id]
        }),
        beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + access_token );},
        success: function(data) {
            console.log(data);
            firstPlay = false;
        },
        error: function(data) {
            console.log("Some error in play");
        }
    });
}



(function() {

    // Firestore listener
    db.collection("rooms").onSnapshot(snapshot => {

        let changes = snapshot.docChanges();
        changes.forEach(change => {
            if (room_id == change.doc.data().id) {
                queue = (change.doc.data().queue);
                console.log("Updated queue: " + queue);
            }

        })
    })

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
                    $('#guest').hide();
                    $('#loggedin').show();

                    guest = false;
                    application = new HostApplication();
                    application.registerSearchListener();

                    host_name = response.display_name;
                    document.getElementById('room_id').innerHTML = "Room Id: " + room_id;

                    document.location.hash = "";

                    db.collection("rooms").add({
                        id: room_id,
                        host: host_name,
                        queue: queue,
                        token: access_token
                    })
                    .then(function(docRef) {
                        console.log("Document written with ID: ", docRef.id);
                        firebaseDocumentReference = docRef.id;
                    })
                    .catch(function(error) {
                        console.error("Error adding document: ", error);
                    });
                }
            });
        } else {
            // render initial screen
            $('#login').show();
            $('#loggedin').hide();
            $('#guest').hide();
        }





        window.onSpotifyWebPlaybackSDKReady = () => {
            const token = access_token;
            const player = new Spotify.Player({
                name: "Insta DJ",
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

        if (!guest) {
            setInterval(function(){
                $.ajax({
                    url: 'https://api.spotify.com/v1/me/player/currently-playing',
                    type: 'GET',
                    headers: {
                        'Authorization' : 'Bearer ' + access_token
                    },
                    success: function(data) {
                        let progress_ms = data.progress_ms;
                        current_track_progress = progress_ms;

                        document.getElementById('currently_playing').innerHTML = "Currently Playing: " + data.item.name + ", by " + data.item.album.artists[0].name;

                        if (queue.length > currentTrackCount) {
                            if ((current_track_progress == 0 && allowNewTrigger)  || firstPlay) {
                                console.log("here");
                                triggerNextTrack();
                                currentTrackCount += 1;
                            }
                        }
                    },
                    error: function(data) {
                        console.log("Some error");
                    }
                });
            }, 2000);
        }
    }
})();
