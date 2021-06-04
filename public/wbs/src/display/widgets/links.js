var h = require('hyperscript');

var rtmp = require('../../lib/rtmp');

function LinksPanel() {
    var self = this;

    var listEl = h('div');

    const urlParams = new URLSearchParams(window.location.search);

    self.element = h('div.mixer',
        h('label', 'Links'),
        listEl);
    let destElement = null;
    {
        let sourceElement = h("p", "input : ", h('input', {
            type: 'text',
            style: 'width:100%',
            placeholder: urlParams.get("input")? urlParams.get("input") : rtmp.getRtmpLink(),
            onchange: function (e) {
                console.log(e.target.value);
                rtmp.changeInputLink(e.target.value);
                destElement.value = rtmp.getHttpLink();
                e.preventDefault()
            }
        }));
        listEl.appendChild(sourceElement);
    }
    {
        destElement = h('input', {
            type: 'text',
            style: 'width:100%',
            value: rtmp.getHttpLink(),
            onchange: function (e) {
                e.preventDefault()
            }
        })
        let element = h("p", "output : ", destElement);
        listEl.appendChild(element);
    }
    if(urlParams.get("input")) {
        rtmp.changeInputLink(urlParams.get("input"));
        destElement.value = rtmp.getHttpLink();
    }
}

module.exports = LinksPanel;