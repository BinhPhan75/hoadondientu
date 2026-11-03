ProductNumberPagination: function (options, data) {
            var defaults = {
                number: 10
            };
            var options = $.extend(defaults, options);
            
            //Creating a reference to the object
            var objContent = $(this);

            // other inner variables
            var fullPages = new Array();
            var subPages = new Array();
            var k = 0;
            var currentPage = 0;
            var pageCount = 1;
            $('.VATTEMP').css('position', 'relative');

            if ($('.invtable').length > 0 && data && data.IsAutoRow && !data.IsRowPerPage) {
                //var headerHeight = $(".VATTEMP .content #header").height();
                //var headerTitleHeight = $(".VATTEMP .content #main-content .header-title").height(); // mot so mau moi co element dong nay
                //var compHeight = $(".VATTEMP .content #main-content .comp").height();
                //var cusHeight = $(".VATTEMP .content #main-content .cus").height();
                //var taikhoan = $(".VATTEMP .content #main-content .taikhoan").height(); // mot so mau moi co element dong nay
                //var topHeight = headerHeight + compHeight + cusHeight + headerTitleHeight + taikhoan;
                var topHeight = $('.invtable').offset().top - $('.VATTEMP').offset().top;
                var docHeight = data.Layout == 0 ? 890 : 1170;
                var tempHeight = topHeight;
                var emptyRow = null;
                //var bottomHeight = $(".VATTEMP .invtable .nextpage").height() + $(".VATTEMP .sds").height() + $(".VATTEMP .content #footer .fl-r").height() + $(".VATTEMP .content .tracuu").height() + $(".VATTEMP .content .thongbao").height();
                var bottomHeight = $('.VATTEMP').height() + $('.VATTEMP').offset().top - $('.invtable').offset().top - $('.invtable').height();
                var _difference = 0;
                var differenceRowAppended = data.DiffRowBreaking === null ? 260 : data.DiffRowBreaking; //  tang len neu muon giam so dong trong 1 trang va nguoc lai
                // initialization function
                init = function () {
                    objContent.children().slice(0, objContent.children().length).each(function (i) {
                        if (IsEmptyOrUndefined(this)) {
                            tempHeight += $(this).height();
                            var nextRow = $(".invtable").find('tbody').find('tr').eq(i + 1).height();
                            if (nextRow === null) { // truong hop la trang cuoi, thi phai tinh toan cong them footer, vi footer trang cuoi moi hien thi
                                _difference = bottomHeight;
                                nextRow = 0;
                            } else {
                                _difference = differenceRowAppended;
                            }
                            if (docHeight >= tempHeight + _difference && docHeight <= nextRow + tempHeight + _difference) {
                                fullPages.push(subPages);
                                subPages = new Array();
                                subPages.push(this);
                                k = 1;
                                tempHeight = topHeight;
                                $(this).addClass("p" + pageCount);
                                pageCount++;
                            }
                            else {
                                k++;
                                subPages.push(this);
                                $(this).addClass("p" + pageCount);
                            }
                        } else {
                            emptyRow = $(this).clone(true);
                            $(this).css("display", "none");
                        }

                    });

                    if (k > 0) {
                        fullPages.push(subPages);
                    }

                    var lastProdPageHeight = 0;
                    $('.prds .data.p' + pageCount).each(function () {
                        lastProdPageHeight += $(this).outerHeight();
                    });

                    //tinh va break footer, phan chu ky xuong, neu nhu no nam giua 2 trang
                    var differenceBreakFooter = data.DiffFooterBreaking === null ? 0 : data.DiffFooterBreaking; // giam xuong neu muon break som hon va nguoc lai
                    var tableHeaderHeight = $(".VATTEMP .invtable thead").height();
                    var tableFooterHeight = $(".VATTEMP .invtable .nextpage").height();
                    var isBreakFooter = false;
                    if (topHeight + bottomHeight + lastProdPageHeight + tableFooterHeight + tableHeaderHeight - differenceBreakFooter > docHeight) {
                        isBreakFooter = true;
                        //$(".VATTEMP .content #footer").css({ "page-break-before": "always"});
                        pageCount++;
                        if (emptyRow !== null) {
                            $(emptyRow).css("display", "");
                            $(emptyRow).addClass("p" + pageCount);
                            $('.invtable tr.p' + pageCount - 1 + ':last').after(emptyRow.wrap("<div />").parent().html());
                        } else {
                            //var lastRow = $('.invtable tr.p' + pageCount - 1 + ':last');
                            //$('.invtable tr.p' + pageCount - 1 + ':last').after(lastRow.outerHTML);

                            var previousCount = pageCount - 1;
                            var temp = $('.invtable tr.p' + previousCount + ':last');
                            $('.invtable tr.p' + previousCount + ':last').after(temp[0].outerHTML);
                            $('.invtable tr.p' + previousCount + ':last').addClass("p" + pageCount);
                            $('.invtable tr.p' + pageCount + ':last').removeClass("p" + previousCount);
                            $('.invtable tr.p' + pageCount + ':last').find('td').each(function () {
                                $(this).text("");
                            });
                        }
                    }

                    //them dong trong neu nhu cuoi trang con cho trong
                    if (data.IsAppendEmptyRow && !isBreakFooter) {
                        if (emptyRow === null) {
                            emptyRow = $('.invtable tr.p' + pageCount + ':last').clone();
                            for (el of emptyRow[0].cells)
                                $(el).text("");
                        }

                        $(emptyRow).css("display", "");
                        $(emptyRow).addClass("p" + pageCount);

                        tempHeight = 0;
                        var differenceEmptyPage = data.DiffEmptyRowAppended === null ? 50 : data.DiffEmptyRowAppended; // tang len neu muon giam dong trong hoac nguoc lai
                        var defaultEmptyRowHeight = 25;
                        for (var i = 0; i < 10; i++) {
                            if (topHeight + bottomHeight + lastProdPageHeight + tempHeight + tableFooterHeight + tableHeaderHeight + differenceEmptyPage < docHeight) {
                                tempHeight += defaultEmptyRowHeight;
                                $('.invtable tr.p' + pageCount + ':last').after(emptyRow.wrap("<div />").parent().html());
                            } else {
                                break;
                            }
                        }
                    }

                    if (pageCount > 1) {
                        currentPage = 0;
                        // draw controls
                        showPaginationBar(pageCount);

                        // show first page
                        showPageContent(1);
                    }
                };
            } else {
          