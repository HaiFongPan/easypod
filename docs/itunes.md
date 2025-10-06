curl:

curl --request GET \
 --url 'https://itunes.apple.com/search?term=%E8%82%A5%E8%AF%9D&media=podcast&limit=10&attribute=titleTerm&country=CN'

output:

```
{
  "resultCount": 1,
  "results": [
    {
      "wrapperType": "track",
      "kind": "podcast",
      "collectionId": 1603580035,
      "trackId": 1603580035,
      "artistName": "肥杰",
      "collectionName": "肥话连篇",
      "trackName": "肥话连篇",
      "collectionCensoredName": "肥话连篇",
      "trackCensoredName": "肥话连篇",
      "collectionViewUrl": "https://podcasts.apple.com/cn/podcast/%E8%82%A5%E8%AF%9D%E8%BF%9E%E7%AF%87/id1603580035?uo=4",
      "feedUrl": "http://www.ximalaya.com/album/56109512.xml",
      "trackViewUrl": "https://podcasts.apple.com/cn/podcast/%E8%82%A5%E8%AF%9D%E8%BF%9E%E7%AF%87/id1603580035?uo=4",
      "artworkUrl30": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/12/08/74/1208744d-b065-1164-632b-82c97af39412/mza_14598067193335283885.jpeg/30x30bb.jpg",
      "artworkUrl60": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/12/08/74/1208744d-b065-1164-632b-82c97af39412/mza_14598067193335283885.jpeg/60x60bb.jpg",
      "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/12/08/74/1208744d-b065-1164-632b-82c97af39412/mza_14598067193335283885.jpeg/100x100bb.jpg",
      "collectionPrice": 0,
      "trackPrice": 0,
      "collectionHdPrice": 0,
      "releaseDate": "2025-09-28T23:20:00Z",
      "collectionExplicitness": "notExplicit",
      "trackExplicitness": "cleaned",
      "trackCount": 198,
      "trackTimeMillis": 4039,
      "country": "CHN",
      "currency": "CNY",
      "primaryGenreName": "即兴表演",
      "contentAdvisoryRating": "Clean",
      "artworkUrl600": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/12/08/74/1208744d-b065-1164-632b-82c97af39412/mza_14598067193335283885.jpeg/600x600bb.jpg",
      "genreIds": [
        "1495",
        "26",
        "1303",
        "1502",
        "1505"
      ],
      "genres": [
        "即兴表演",
        "播客",
        "喜剧",
        "休闲",
        "爱好"
      ]
    }
  ]
}
```
