// Alex Appel, Yash Thacker
// Some starter code used from Spotify Web and Player API Quick Start Guides

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

var guest;
var our_device_id;
var current_track_progress = 0;
var queue = [];
var displayable_queue = [];
var likes = [];
var my_likes = [];
var allowNewTrigger = false;
var room_id = "";
var firebaseDocumentReference;
var host_name;
var firstPlay = true;
var currently_playing = "";
var next_up = "";
var temp_currently_playing;
var check_currently_playing;
var temp_next_up;
var shifted = false;
var play_url = "";
var currently_playing_image_src = "";
var users = 0;
let room_id_interval;
let current_song_length = 0;
let interval_delta = 0;


console.log("access_token: " + access_token);

document.getElementById("guestplayer").style.display = 'none';
document.getElementById("hostplayer").style.display = 'none';

var ID = function () {
    // Math.random should be unique because of its seeding algorithm.
    // Convert it to base 36 (numbers + letters), and grab the first 6 characters
    // after the decimal.
    return Math.random().toString(36).substr(2, 6);
};


function getHashParams() {
    var hashParams = {};
    var e, r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.hash.substring(1);
    while (e = r.exec(q)) {
        hashParams[e[1]] = decodeURIComponent(e[2]);
    }
    return hashParams;
}


function SongSearchInput(searchBoxQuery, newSearchQuery) {
    var songSearchInputElement = document.getElementById(searchBoxQuery);
    var newSearchElement = document.getElementById(newSearchQuery);

    this.onInput = function (callback) {
        newSearchElement.addEventListener("input", function (event) {
            event.preventDefault();
            var search = newSearchElement.value;
            callback(search);
        })
    }

    this.onSubmit = function (callback) {
        songSearchInputElement.addEventListener("submit", function (event) {
            event.preventDefault();
            var search = newSearchElement.value;
            callback(search);
            newSearchElement.value = "";
        })
    }

}


// Performs spotify search on given query
function SpotifyAPI(resultsListQuery) {
    this.performSearch = function (search, callback) {
        document.getElementById(resultsListQuery).innerHTML = '';

        $.ajax({
            url: 'https://api.spotify.com/v1/search?q=' + search + '&type=track&market=US&limit=15',
            type: 'GET',
            headers: {
                'Authorization': 'Bearer ' + access_token
            },
            success: function (data) {
                callback(data);
            },
            error: function (data) {
                console.log("Some error: " + error);
                console.log("Search was: " + search);
            }
        });
    }
}


// Results list of spotify search
function ResultsList(resultsListQuery) {
    var resultsList = document.getElementById(resultsListQuery);

    this.setSearchResults = function (data) {
        // Parse response for tracks
        for (var i = 0; i < data.tracks.items.length; i++) {
            let item = data.tracks.items[i];

            // Populate list of results
            let entry = document.createElement("div");

            var image = new Image();
            image.src = item.album.images[0].url;
            image.height = 50; //height of the album art in the list of search
            image.width = 50;
            entry.appendChild(image);
            let songtitle = document.createElement("h1");
            let songartist = document.createElement("p");
            entry.appendChild(songtitle);
            songtitle.appendChild(document.createTextNode(item.name));
            entry.appendChild(songartist);
            songartist.appendChild(document.createTextNode("By: " + item.album.artists[0].name));

            // Add onclick listener to add selected track to queue
            entry.onclick = function () {
                queue.push("spotify:track:" + item.id);
                displayable_queue.push(item.name)
                likes.push(0);
                my_likes.push(false);

                document.getElementById(resultsListQuery).innerHTML = '';

                if (guest) {
                    document.getElementById("newSearch2").value = '';
                } else {
                    document.getElementById("newSearch").value = '';
                }

                // Update Firestore
                var roomRef = db.collection("rooms").doc(firebaseDocumentReference);

                // Set the queue in Firestore to our queue
                return roomRef.update({
                        queue: queue,
                        displayable_queue: displayable_queue,
                        likes: likes
                    })
                    .then(function () {
                        console.log("Document successfully updated!");
                    })
                    .catch(function (error) {
                        // The document probably doesn't exist.
                        console.error("Error updating document: ", error);
                    });


            };
            resultsList.appendChild(entry);
        }
    }
}


// Version of app for guest
function GuestApplication() {
    var spotifyAPI = new SpotifyAPI("resultsList2");
    var songSearchInput = new SongSearchInput("searchBox2", "newSearch2");
    var resultsListView = new ResultsList("resultsList2");

    guest = true;

    this.registerSearchListener = function () {
        songSearchInput.onSubmit(function (search) {
            spotifyAPI.performSearch(search, function (results) {
                resultsListView.setSearchResults(results);
            })
        })
    }

    this.registerInputSearchListener = function () {
        songSearchInput.onInput(function (search) {
            spotifyAPI.performSearch(search, function (results) {
                resultsListView.setSearchResults(results);
            })
        })
    }


    setInterval(function () {
        document.getElementById('currently_playing2').innerHTML = currently_playing;


        // Set currently playing image

        if (currently_playing_image_src != "") {
            var currently_playing_image_guest = document.getElementById("currently_playing_image_guest");
            currently_playing_image_guest.src = currently_playing_image_src;
            let bk2 = document.getElementById("background2");
            bk2.src = currently_playing_image_src;
            currently_playing_image_guest.height = 600; //album art of the song currently playing
            currently_playing_image_guest.width = 600;
            document.getElementById("guestplayer").style.display = 'block';
        } else {
            document.getElementById("guestplayer").style.display = 'none';
        }

    }, 1000);
}


// Version of app for host
function HostApplication() {
    var spotifyAPI = new SpotifyAPI("resultsList");
    var songSearchInput = new SongSearchInput("searchBox", "newSearch");
    var resultsListView = new ResultsList("resultsList");

    guest = false;

    this.registerSearchListener = function () {
        songSearchInput.onSubmit(function (search) {
            spotifyAPI.performSearch(search, function (results) {
                resultsListView.setSearchResults(results);
            })
        })

    }

    this.registerInputSearchListener = function () {
        songSearchInput.onInput(function (search) {
            spotifyAPI.performSearch(search, function (results) {
                resultsListView.setSearchResults(results);
            })
        })
    }


    document.getElementById("myRange").addEventListener("change", function (event) {
        seek((document.getElementById("myRange").value * current_song_length) / 100);
    });


    setInterval(function () {

        if (!queue[0]) {
            return;
        }

        if (queue[1]) {
            var search = queue[1].replace("spotify:track:", "");

            $.ajax({
                url: 'https://api.spotify.com/v1/tracks/' + search,
                type: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + access_token
                },
                success: function (data) {
                    next_up = "Next Up: " + data.name + ", by " + data.album.artists[0].name;
                },
                error: function (data) {
                    console.log("Some error");
                }
            });
        } else {
            next_up = "";
        }

        if (allowNewTrigger || firstPlay) {
            allowNewTrigger = false;
            triggerNextTrack();
        }

        $.ajax({
            url: 'https://api.spotify.com/v1/me/player/currently-playing',
            type: 'GET',
            headers: {
                'Authorization': 'Bearer ' + access_token
            },
            success: function (data) {
                let progress_ms = data.progress_ms;
                current_track_progress = progress_ms;

                current_song_length = data.item.duration_ms;

                document.getElementById("myRange").value = (current_track_progress / current_song_length) * 100;

                displayTime();

                // Set currently playing image
                var currently_playing_image = document.getElementById("currently_playing_image");

                currently_playing_image_src = data.item.album.images[0].url;
                currently_playing_image.src = currently_playing_image_src;
                let bk = document.getElementById("background");
                bk.src = currently_playing_image_src;
                currently_playing_image.height = 600;
                currently_playing_image.width = 600;

                if (current_track_progress == 0) {
                    allowNewTrigger = true;

                    currently_playing = "";
                    next_up = "";

                    document.getElementById("currently_playing").innerHTML = currently_playing;
                } else {
                    allowNewTrigger = false;
                    shifted = false;
                }

                if (allowNewTrigger || firstPlay) {
                    allowNewTrigger = false;
                    triggerNextTrack();
                }
                currently_playing = data.item.name + "<br> by: " + data.item.album.artists[0].name;
                document.getElementById('currently_playing').innerHTML = currently_playing;


            },
            error: function (data) {
                console.log("Some error in currently playing");
            }
        });

        if (temp_currently_playing != currently_playing) {
            temp_currently_playing = currently_playing;

            // Update Firestore
            var roomRef = db.collection("rooms").doc(firebaseDocumentReference);

            // Set currently_playing and next up in Firestore to currently playing and next up songs
            return roomRef.update({
                    currently_playing: currently_playing,
                    currently_playing_image_src: currently_playing_image_src
                })
                .then(function () {
                    console.log("Document successfully updated!");
                })
                .catch(function (error) {
                    // The document probably doesn't exist.
                    console.error("Error updating document: ", error);
                });
        }

        if (temp_next_up != next_up) {
            temp_next_up = next_up;

            // Update Firestore
            var roomRef = db.collection("rooms").doc(firebaseDocumentReference);

            // Set currently_playing and next up in Firestore to currently playing and next up songs
            return roomRef.update({
                    next_up: next_up
                })
                .then(function () {
                    console.log("Document successfully updated!");
                })
                .catch(function (error) {
                    // The document probably doesn't exist.
                    console.error("Error updating document: ", error);
                });
        }
    }, 2000);
}

var application;


// Click event listener for joining a new room
document.getElementById("join_existing").addEventListener("submit", function (event) {
    event.preventDefault();
    guest = true;

    application = new GuestApplication();
    application.registerSearchListener();
    application.registerInputSearchListener();

    var code = document.getElementById('room_code').value;

    // Query Firestore to cross-check entered code
    db.collection("rooms").where("id", "==", code).get().then(function (querySnapshot) {
            querySnapshot.forEach(function (doc) {
                // doc.data() is never undefined for query doc snapshots
                console.log("inside get");
                let data = doc.data();

                if (code == data.id) {
                    room_id = data.id;
                    host_name = data.host;
                    queue = data.queue;
                    displayable_queue = data.displayable_queue;
                    likes = data.likes;
                    access_token = data.token;
                    next_up = data.next_up;
                    currently_playing = data.currently_playing;
                    currently_playing_image_src = data.currently_playing_image_src;
                    users = data.users;
                    firebaseDocumentReference = doc.id;

                    temp_currently_playing = currently_playing;

                    document.getElementById('host_name2').innerHTML = "Your host is: " + host_name;
                    document.getElementById('room_id2').innerHTML = "Room Id: " + room_id;
                    $('#login').hide();
                    let animationtxt = document.getElementById("aminationtxt");
                    animationtxt.parentNode.removeChild(animationtxt);
                    document.body.style.backgroundColor = "white";
                    $('#guest').show();


                    users += 1;

                    console.log("users: " + users);

                    // Update Firestore
                    var roomRef = db.collection("rooms").doc(firebaseDocumentReference);

                    // Update number of users in Firestore
                    return roomRef.update({
                            users: users
                        })
                        .then(function () {
                            console.log("Document successfully updated!");
                        })
                        .catch(function (error) {
                            // The document probably doesn't exist.
                            console.error("Error updating document: ", error);
                        });
                }
            });

        })
        .catch(function (error) {
            console.log("Error getting documents: ", error);
        });

    if (room_id != "") {
        setFirebaseListeners();
    }


});


// Plays next track
function triggerNextTrack() {
    if (!shifted && queue.length > 1) {
        queue.shift();
        displayable_queue.shift();
        likes.shift();
        my_likes.shift();
        shifted = true;

        // Update Firestore
        var roomRef = db.collection("rooms").doc(firebaseDocumentReference);

        // Set the queue in Firestore to our queue
        return roomRef.update({
                queue: queue,
                displayable_queue: displayable_queue,
                likes: likes
            })
            .then(function () {
                console.log("Document successfully updated!");
            })
            .catch(function (error) {
                // The document probably doesn't exist.
                console.error("Error updating document: ", error);
            });
    }

    play(our_device_id, queue[0]);
}


// Play a specified track on the device id
function play(device_id, track_id) {

    if (firstPlay) {
        play_url = "https://api.spotify.com/v1/me/player/play?device_id=" + device_id
    } else {
        play_url = "https://api.spotify.com/v1/me/player/play"
    }

    $.ajax({
        url: play_url,
        type: "PUT",
        data: JSON.stringify({
            "uris": [track_id]
        }),
        beforeSend: function (xhr) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
        },
        success: function (data) {
            console.log(data);
            firstPlay = false;
        },
        error: function (data) {
            console.log("Some error in play");
        }
    });
}


// Displays current timestamp in song in human readable form
function displayTime() {
    let song_length_in_sec = Math.round(current_song_length / 1000);

    let percentage = (current_track_progress / current_song_length) * 100;

    let progress_in_seconds = Math.round((song_length_in_sec * percentage) / 100);

    let progress_in_minutes = Math.round(progress_in_seconds / 60);

    let minutes = Math.floor(progress_in_seconds / 60);
    let seconds = Math.floor(progress_in_seconds - (minutes * 60));

    if (minutes < 1) {
        if (seconds < 10) {
            seconds = seconds.toString();
            seconds = "0" + seconds;
        }
        document.getElementById("displayNumber").innerHTML = "0:" + seconds;
    } else {
        if (seconds < 10) {
            seconds = seconds.toString();
            seconds = "0" + seconds;
        }
        document.getElementById("displayNumber").innerHTML = minutes + ":" + seconds;
    }
}


// Monitors pause/play button and current progress
function monitor_player_controls(button) {

    if (current_track_progress > 0) {

        // Show slider and time display when there is a currently playing song
        document.getElementById("hostplayer").style.display = 'block';

        // Get player's current state
        player.getCurrentState().then(state => {

            // Check if current song is paused
            if (!state.paused) {
                // If yes, set button to 'pause'
                document.getElementById('play_pause_i').className = 'fa fa-pause';

                // Increment current_track_progress using delta timing (to reduce the necessecity/frequency for Spotify polling)
                if (interval_delta >= 1000) {
                    interval_delta = 0;
                    current_track_progress += 1000;

                    displayTime();
                }

            } else {
                // If no, set button to 'play'
                document.getElementById('play_pause_i').className = 'fa fa-play';
            }

        });
    } else {
        document.getElementById("hostplayer").style.display = 'none';
    }
}


// Toggle between paused and playing in our Spotify web player
function togglePlayback() {
    // Toggle spotify player playback
    player.togglePlay().then(() => {
        console.log('Toggled playback!');
    });

    // Call set pause play button to react to our change
    monitor_player_controls(document.getElementById('play_pause_bttn'));
}


// Seek to a point in the track
function seek(time) {
    // Set spotify web player location to correct time
    player.seek(time).then(() => {
        console.log('Changed position!');
    });
}


// Interval timer that calls monitor_player_contol button reflect the current state of playback
// A change in playback state of the player from any device will be reflected
setInterval(function () {
    if (!guest) {
        interval_delta += 500;
        monitor_player_controls(document.getElementById('play_pause_bttn'));
    }
}, 500);


// Skip to the next song in queue
function skip() {
    // Check if there is a currently playing track
    if (current_track_progress > 0) {
        console.log("skip button clicked");
        allowNewTrigger = !allowNewTrigger;
        triggerNextTrack();
    }
}


// Set on change listeners to Firestore database
function setFirebaseListeners() {
    // Firestore listener
    db.collection("rooms").where("id", "==", room_id).onSnapshot(snapshot => {
        console.log(snapshot);

        let changes = snapshot.docChanges();
        changes.forEach(function (change) {
            console.log("inside changes");
            queue = (change.doc.data().queue);
            displayable_queue = (change.doc.data().displayable_queue);
            likes = (change.doc.data().likes);
            currently_playing = (change.doc.data().currently_playing);
            next_up = (change.doc.data().next_up);
            currently_playing_image_src = (change.doc.data().currently_playing_image_src);
            users = (change.doc.data().users);
        })

        if (check_currently_playing != currently_playing) {
            check_currently_playing = currently_playing;

            if (firstPlay && guest) {
                firstPlay = false;
            } else {
                my_likes.shift();
            }

        }

        let difference = (queue.length - my_likes.length);

        if (difference > 0) {
            for (let i = 0; i < difference; i++) {
                my_likes.push(false);
            }
        }

        console.log("current queue is: " + displayable_queue);

        let queue_list;

        // Update queue list displayed in UI
        if (guest) {
            queue_list = document.getElementById('queueList2');
        } else {
            queue_list = document.getElementById('queueList');
        }



        // Remove current elements of list
        while (queue_list.hasChildNodes()) {
            queue_list.removeChild(queue_list.firstChild);
        }
        // Populate list with current song queue
        for (let i = 1; i < displayable_queue.length; i++) {
            var song = document.createElement('li');
            song.appendChild(document.createTextNode(displayable_queue[i]));
            let like_button = document.createElement("button");


            like_button.innerHTML = likes[i];


            // Click event listener to like button
            like_button.addEventListener("click", function (event) {
                console.log("like button clicked");

                like_button.innerHTML = likes[i];

                my_likes[i] = !my_likes[i];

                if (!my_likes[i]) {
                    likes[i] -= 1;
                } else {
                    likes[i] += 1;
                }

                let index = displayable_queue.length + 1;

                while (index > 1) {
                    // Check if liked song has more likes than previous song
                    // If yes, perform swapping operations
                    if (likes[index] > likes[index - 1]) {
                        // Swap like counters
                        let temp = likes[index - 1];
                        likes[index - 1] = likes[index];
                        likes[index] = temp;

                        // Swap songs in queue
                        temp = queue[index - 1];
                        queue[index - 1] = queue[index];
                        queue[index] = temp;

                        // Swap songs in displayable_queue
                        temp = displayable_queue[index - 1];
                        displayable_queue[index - 1] = displayable_queue[index];
                        displayable_queue[index] = temp;

                        // Swap values my likes array
                        temp = my_likes[index - 1];
                        my_likes[index - 1] = my_likes[index];
                        my_likes[index] = temp;


                        // Swap down the queue that we just went upwards on to set everything to the correct order
                        let index2 = index;
                        while (index2 <= displayable_queue.length) {

                            if (likes[index] < likes[index + 1]) {
                                // Swap like counters
                                let temp = likes[index + 1];
                                likes[index + 1] = likes[index];
                                likes[index] = temp;

                                // Swap songs in queue
                                temp = queue[index + 1];
                                queue[index + 1] = queue[index];
                                queue[index] = temp;

                                // Swap songs in displayable_queue
                                temp = displayable_queue[index + 1];
                                displayable_queue[index + 1] = displayable_queue[index];
                                displayable_queue[index] = temp;

                                // Swap values my likes array
                                temp = my_likes[index + 1];
                                my_likes[index + 1] = my_likes[index];
                                my_likes[index] = temp;
                            }

                            index2 = index2 + 1;
                        }
                    }

                    index = index - 1;
                }

                // Update Firestore
                var roomRef = db.collection("rooms").doc(firebaseDocumentReference);

                // Set the queue in Firestore to our queue
                return roomRef.update({
                        queue: queue,
                        displayable_queue: displayable_queue,
                        likes: likes
                    })
                    .then(function () {
                        console.log("Document successfully updated!");
                    })
                    .catch(function (error) {
                        // The document probably doesn't exist.
                        console.error("Error updating document: ", error);
                    });

            });

            song.appendChild(like_button);

            queue_list.appendChild(song);
        }
    })
}



//obtained time out from here: https://www.sitepoint.com/jquery-settimeout-function-examples/
//css here: https://codepen.io/anon/pen/eojpja
setTimeout(function () {
    var text = $(".text");
    $(window).ready(function () {
        var scroll = $(window).ready().delay(800);
        if (scroll) {
            text.removeClass("hidden");
        } else {
            text.addClass("hidden");
        }
    });
}, 1000, showlogin());

function showlogin() {
    setTimeout(function () {}, 800, showlog());
}

function showlog() {
    setTimeout(function () {
        $('#login').css({
            opacity: 0,
            visibility: "visible"
        }).animate({
            opacity: 1
        }, 500);
    }, 1500);
}

setInterval(function () {
    var $info = $("#info");
    var $isHovered = $("#mkroom");
    if ($isHovered.is(":hover")) {
        $info.css("visibility", "visible");
    } else {
        $info.css("visibility", "hidden");
    }
}, 100);

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
            success: function (response) {
                userProfilePlaceholder.innerHTML = userProfileTemplate(response);

                $('#login').hide();
                let animationtxt = document.getElementById("aminationtxt");
                animationtxt.parentNode.removeChild(animationtxt);
                document.body.style.backgroundColor = "white";
                $('#guest').hide();
                $('#loggedin').show();

                guest = false;
                application = new HostApplication();
                application.registerSearchListener();
                application.registerInputSearchListener();

                room_id = ID();

                host_name = response.display_name;
                document.getElementById('room_id').innerHTML = "Room Id: " + room_id;

                document.location.hash = "";

                db.collection("rooms").add({
                        id: room_id,
                        host: host_name,
                        queue: queue,
                        displayable_queue: displayable_queue,
                        likes: likes,
                        token: access_token,
                        currently_playing: currently_playing,
                        next_up: next_up,
                        currently_playing_image_src: currently_playing_image_src,
                        users: users + 1
                    })
                    .then(function (docRef) {
                        console.log("Document written with ID: ", docRef.id);
                        console.log("access_token: " + access_token);
                        firebaseDocumentReference = docRef.id;
                        document.getElementById('users').innerHTML = "Listeners: " + users;
                    })
                    .catch(function (error) {
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

    console.log("inside room_id");
    room_id_interval = setInterval(function () {
        if (room_id != "") {
            setFirebaseListeners();
            clearInterval(room_id_interval);
        }
    }, 2000);

    if (!guest) {
        window.onSpotifyWebPlaybackSDKReady = () => {
            const token = access_token;
            const player = new Spotify.Player({
                name: "Q Web Player",
                getOAuthToken: cb => {
                    cb(token);
                }
            });
            window.player = player;

            // Error handling
            player.addListener('initialization_error', ({
                message
            }) => {
                console.error(message);
            });
            player.addListener('authentication_error', ({
                message
            }) => {
                console.error(message);
            });
            player.addListener('account_error', ({
                message
            }) => {
                console.error(message);
            });
            player.addListener('playback_error', ({
                message
            }) => {
                console.error(message);
            });

            // Playback status updates
            player.addListener('player_state_changed', state => {
                console.log(state);
            });

            // Ready
            player.addListener('ready', ({
                device_id
            }) => {
                console.log('Ready with Device ID', device_id);

                our_device_id = device_id;
            });

            // Not Ready
            player.addListener('not_ready', ({
                device_id
            }) => {
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
    }

}
