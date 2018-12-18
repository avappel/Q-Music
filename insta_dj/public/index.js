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
    // Convert it to base 36 (numbers + letters), and grab the first 9 characters
    // after the decimal.
    return Math.random().toString(36).substr(2, 6);
};

var guest = false;

var guest_data_id;
var guest_host;
var guest_queue;
var guest_access_token;
var guest_device_id;

var our_device_id;

var current_track_progress = 0;

var queue = [];
var currentTrackCount = 0;

var allowNewTrigger = true;

let room_id = ID();

var firebaseDocumentReference;

var guestFirebaseDocumentReference;

var host_name;

var current_track_name;

document.getElementById("join_existing").addEventListener("submit", function(event) {
    event.preventDefault();

    guest = true;

    var code = document.getElementById('room_code').value;

    // Query Firestore to cross-check entered code
    db.collection("rooms").get().then(function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
            // doc.data() is never undefined for query doc snapshots

            let data = doc.data();

            if (code == data.id) {
                guest_data_id = data.id;
                guest_host = data.host;
                guest_queue = data.queue;
                guest_access_token = data.token;
                guest_device_id = data.device_id;
                guestFirebaseDocumentReference = doc.id;

                access_token = guest_access_token;

                document.getElementById('host_name').innerHTML = "Host: " + guest_host;
                document.getElementById('room_id').innerHTML = "Room Id: " + guest_data_id;
                $('#login').hide();
                $('#guest').show();
            }
        });
    })
    .catch(function(error) {
        console.log("Error getting documents: ", error);
    });
});



(function() {

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

        function triggerNextTrack() {
            allowNewTrigger = true;
            play(our_device_id, queue[currentTrackCount]);
        }

        // Play a specified track on the device id
        function play(device_id, track_id) {
            const token = access_token;
            $.ajax({
                url: "https://api.spotify.com/v1/me/player/play?device_id=" + device_id,
                type: "PUT",
                data: '{"uris": ["spotify:track:' + track_id + '"]}',
                beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + token );},
                success: function(data) {
                    console.log(data);
                }
            });

            // setInterval(function(){
            //     $.ajax({
            //         url: 'https://api.spotify.com/v1/me/player/currently-playing',
            //         type: 'GET',
            //         headers: {
            //             'Authorization' : 'Bearer ' + access_token
            //         },
            //         success: function(data) {
            //             let progress_ms = data.progress_ms;
            //             current_track_progress = progress_ms;
            //
            //             document.getElementById('currently_playing').innerHTML = "Currently Playing: " + data.item.name + ", by " + data.item.album.artists[0].name;
            //
            //             if (progress_ms == 0 && allowNewTrigger) {
            //                 currentTrackCount += 1;
            //                 triggerNextTrack();
            //                 allowNewTrigger = false;
            //             }
            //         },
            //         error: function(data) {
            //             console.log("Some error");
            //         }
            //     });
            //
            // }, 3000);
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


        setInterval(function(){
            // Query Firestore to cross-check entered code
            db.collection("rooms").get().then(function(querySnapshot) {
                querySnapshot.forEach(function(doc) {

                    let data = doc.data();

                    if (firebaseDocumentReference == doc.id) {
                        queue = data.queue;
                    }
                    else if (guestFirebaseDocumentReference == doc.id) {
                        guest_queue = data.queue;
                    }
                });
            })
            .catch(function(error) {
                console.log("Error getting documents: ", error);
            });

            if (!guest && current_track_progress == 0) {
                triggerNextTrack();
            }

            if (guest && guest_queue[currentTrackCount + 1]) {
                document.getElementById('next_up').innerHTML = "Next Up: " + guest_queue[currentTrackCount + 1]; // + ", by " + data.item.album.artists[0].name;


                $.ajax({
                    url: 'https://api.spotify.com/v1/tracks/' + guest_queue[currentTrackCount + 1],
                    type: 'GET',
                    headers: {
                        'Authorization' : 'Bearer ' + access_token
                    },
                    success: function(data) {
                        document.getElementById('next_up').innerHTML = "Next Up: " + data.name + ", by " + data.album.artists[0].name;
                    },
                    error: function(data) {
                        console.log("Some error");
                    }
                });

            }
            else if (!guest && queue[currentTrackCount + 1]) {

                $.ajax({
                    url: 'https://api.spotify.com/v1/tracks/' + queue[currentTrackCount + 1],
                    type: 'GET',
                    headers: {
                        'Authorization' : 'Bearer ' + access_token
                    },
                    success: function(data) {
                        document.getElementById('next_up').innerHTML = "Next Up: " + data.name + ", by " + data.album.artists[0].name;
                    },
                    error: function(data) {
                        console.log("Some error");
                    }
                });
            }


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

                    if (progress_ms == 0 && allowNewTrigger) {
                        currentTrackCount += 1;
                        triggerNextTrack();
                        allowNewTrigger = false;
                    }
                },
                error: function(data) {
                    console.log("Some error");
                }
            });



        }, 3000);


        var resultsList = document.getElementById("resultsList");

        // Handle new search form submit
        document.getElementById("searchBox").addEventListener("submit", function(event) {
            var search = document.getElementById('newSearch').value;
            document.getElementById('newSearch').value = "";
            event.preventDefault();

            // Empty list of results before populating with new results
            document.getElementById('resultsList').innerHTML = '';

            $.ajax({
                url: 'https://api.spotify.com/v1/search?q=' + search + '&type=track&market=US&limit=10',
                type: 'GET',
                headers: {
                    'Authorization' : 'Bearer ' + access_token
                },
                success: function(data) {

                    // Parse response for tracks
                    for (var i = 0; i < data.tracks.items.length; i++) {
                        let item = data.tracks.items[i];

                        // Populate list of results
                        let entry = document.createElement("li");
                        entry.appendChild(document.createTextNode("Track: " + item.name));

                        // Add onclick listener to add selected track to queue
                        entry.onclick = function() {
                            queue.push(item.id);

                            if (current_track_progress == 0) {
                                triggerNextTrack();
                            }

                            // Update Firestore
                            var roomRef = db.collection("rooms").doc(firebaseDocumentReference);

                            // Set the queue in Firestore to our queue
                            return roomRef.update({
                                queue: queue,
                                device_id: our_device_id
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

                },
                error: function(data) {
                    console.log("Some error");
                }
            });
        });

        var resultsList2 = document.getElementById("resultsList2");


        // Handle new search form submit
        document.getElementById("searchBox2").addEventListener("submit", function(event) {
            var search = document.getElementById('newSearch2').value;
            document.getElementById('newSearch2').value = "";
            event.preventDefault();

            // Empty list of results before populating with new results
            document.getElementById('resultsList2').innerHTML = '';

            $.ajax({
                url: 'https://api.spotify.com/v1/search?q=' + search + '&type=track&market=US&limit=10',
                type: 'GET',
                headers: {
                    'Authorization' : 'Bearer ' + access_token
                },
                success: function(data) {

                    // Parse response for tracks
                    for (var i = 0; i < data.tracks.items.length; i++) {
                        let item = data.tracks.items[i];
                        console.log(item.name);

                        // Populate list of results
                        let entry = document.createElement("li");
                        entry.appendChild(document.createTextNode("Track: " + item.name));

                        // Add onclick listener to add selected track to queue
                        entry.onclick = function() {
                            guest_queue.push(item.id);

                            // Update Firestore
                            var roomRef = db.collection("rooms").doc(guestFirebaseDocumentReference);

                            // Set the queue in Firestore to our queue
                            return roomRef.update({
                                queue: guest_queue
                            })
                            .then(function() {
                                console.log("Document successfully updated!");
                            })
                            .catch(function(error) {
                                // The document probably doesn't exist.
                                console.error("Error updating document: ", error);
                            });

                        };

                        resultsList2.appendChild(entry);
                    }

                },
                error: function(data) {
                    console.log("Some error");
                }
            });
        });
    }
})();
