const suggestionTemplate = document.querySelector("#suggestion-template");
$("#search-input").keyup(async function(ev) {
    if (!$(this).val()) return;
    const suggestions = (await findUsersByNickname($(this).val())).response;
    if (ev.key == "Enter" && suggestions[0] && suggestions[0].nickname.toLowerCase() == $(this).val().toLowerCase()) {
        location.href = `/stats/${suggestions[0].uid}`;
    }
    const parentContainer = $("#search-suggestions");
    parentContainer.scrollTop(0);
    parentContainer.empty();
    for (const s of suggestions) {
        let clone = suggestionTemplate.content.cloneNode(true);
        $(clone).find(".suggestion").text(s.nickname).attr("href", `/stats/${s.uid}`);
        parentContainer.append(clone);
    }
});