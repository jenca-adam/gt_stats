$.fn.tabs = function() {
    const tabsEl = this;
    this.children(".tab").filter(function() {
        return !$(this).hasClass("active")
    }).hide();
    var activeTab = this.children(".tab.active").data("tab");
    this.children(".tablist").children(".tab-button").filter(function() {
        return $(this).data("tab") == activeTab
    }).addClass("active");

    this.children(".tablist").children(".tab-button").click(function() {
        tabsEl.children(".tablist").children(".tab-button.active").removeClass("active");
        $(this).addClass("active");
        var tab = $(this).data("tab");
        var tabs = $(this).parent().parent().children(".tab");
        tabs.removeClass("active").hide(0);
        tabs.filter(function() {
            return $(this).data("tab") == tab
        }).addClass("active").fadeIn(100);
    });
}
