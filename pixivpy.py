import sys
from flask import Flask, request, jsonify
from pixivpy3 import AppPixivAPI
app = Flask(__name__)

pixivclients = dict()


@app.route('/login', methods=['POST'])
# 登录
def login():
    username = request.json['username']
    password = request.json['password']

    try:
        api = AppPixivAPI()
        api.login(username, password)

        pixivclients[username] = api

        return jsonify({'code': 0})
    except Exception as err:
        print(err)
        return jsonify({'code': -1})


@app.route('/illust_detail', methods=['POST'])
# 作品详情
def illust_detail():
    username = request.json['username']
    illust_id = request.json['illust_id']

    api = pixivclients[username]
    try:
        json_result = api.illust_detail(illust_id)

        return jsonify({'code': 0, 'json_result': json_result})
    except Exception as err:
        print(err)
        return jsonify({'code': 1})

    return


@app.route('/search_illust', methods=['POST'])
# 搜索 (Search)
# search_target - 搜索类型
#   partial_match_for_tags  - 标签部分一致
#   exact_match_for_tags    - 标签完全一致
#   title_and_caption       - 标题说明文
# sort: [date_desc, date_asc, popular_desc] - popular_desc为会员的热门排序
# duration: [within_last_day, within_last_week, within_last_month]
# start_date, end_date: '2020-07-01'
def search_illust():
    username = request.json['username']
    word = request.json['word']
    search_target = request.json.get('search_target', 'partial_match_for_tags')
    sort = request.json.get('sort', 'date_desc')
    duration = request.json.get('duration', None)
    start_date = request.json.get('start_date', None)
    end_date = request.json.get('end_date', None)
    _filter = request.json.get('filter', 'for_ios')
    offset = request.json.get('offset', None)

    api = pixivclients[username]
    try:
        json_result = api.search_illust(
            word,
            search_target=search_target,
            sort=sort,
            duration=duration,
            start_date=start_date,
            end_date=end_date,
            filter=_filter,
            offset=offset
        )

        return jsonify({'code': 0, 'json_result': json_result})
    except Exception as err:
        print(err)
        return jsonify({'code': 2})


host = sys.argv[1]
port = int(sys.argv[2])

if __name__ == "__main__":
    app.run(host=host, port=port)
