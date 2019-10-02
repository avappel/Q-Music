'use strict';

// React component for slider and progress time display
const e = React.createElement;

class Slider extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {

    return e(
      "div", {
        className: "slider_container"
      }, 
      
      React.createElement("input", {
        type: "range",
        min: "0",
        max: "100",
        className: "slider",
        id: "myRange"
      }),

      
      React.createElement("p", {id: "displayNumber"}));
  }
}

const domContainer = document.querySelector('#slider_container');
ReactDOM.render(e(Slider), domContainer);
