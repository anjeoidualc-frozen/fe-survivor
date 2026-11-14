from heroes import *
LEG_STRIKE = dict(legB=(-2, 0), legF=(2, 0))
def act_poses(name):
    A = {
     'davi': [
       dict(dy=0, tdx=-1, hdx=0, armF=(13, 6), armB=(2, 14), sling=(-115, 4, True), eyes='focus', **LEG_STRIKE),
       dict(dy=0, tdx=0, hdx=0, armF=(15, 5), armB=(2, 15), sling=(-35, 5, True), eyes='focus', **LEG_STRIKE),
       dict(dy=0, tdx=1, hdx=1, armF=(16, 10), armB=(1, 16), sling=(5, 3, False), eyes='open', mouth='open', legB=(-3, 0), legF=(3, 0)),
       dict(dy=0, tdx=0, hdx=0, armF=(13, 14), armB=(3, 16), sling=(95, 3, False), **LEG_STRIKE)],
     'paulo': [
       dict(dy=0, tdx=-1, hdx=-1, armF=(12, 7), armB=(4, 15), pa=-112, bl=8, eyes='focus', **LEG_STRIKE),
       dict(dy=0, tdx=0, hdx=0, armF=(15, 8), armB=(3, 15), pa=-45, bl=8, eyes='focus', **LEG_STRIKE),
       dict(dy=0, tdx=1, hdx=1, armF=(16, 12), armB=(2, 15), pa=8, bl=9, mouth='open', legB=(-3, 0), legF=(3, 0)),
       dict(dy=0, tdx=1, hdx=0, armF=(14, 15), armB=(3, 16), pa=62, bl=8, **LEG_STRIKE)],
     'debora': [
       dict(dy=0, armF=(13, 9), armB=(3, 9), pa=-88, eyes='focus', glow=False, **LEG_STRIKE),
       dict(dy=0, armF=(13, 6), armB=(2, 6), pa=-80, eyes='focus', glow=True, mouth='open', **LEG_STRIKE),
       dict(dy=0, tdx=1, hdx=0, armF=(14, 11), armB=(2, 9), pa=-62, glow=True, mouth='open', **LEG_STRIKE),
       dict(dy=0, armF=(13, 14), armB=(3, 15), pa=-85, **LEG_STRIKE)],
     'sansao': [
       dict(dy=0, tdx=-1, hdx=-1, armF=(11, 5), armB=(4, 6), pa=-128, eyes='focus', **LEG_STRIKE),
       dict(dy=0, tdx=0, hdx=0, armF=(13, 5), armB=(5, 6), pa=-85, eyes='focus', mouth='open', **LEG_STRIKE),
       dict(dy=1, tdx=1, hdx=1, armF=(16, 13), armB=(7, 12), pa=28, mouth='open', legB=(-3, 0), legF=(3, 0)),
       dict(dy=1, tdx=1, hdx=1, armF=(15, 15), armB=(5, 14), pa=62, **LEG_STRIKE)],
     'ester': [
       dict(dy=0, armF=(12, 8), armB=(3, 14), pa=-90, eyes='focus', **LEG_STRIKE),
       dict(dy=0, tdx=0, armF=(15, 9), armB=(2, 13), pa=-52, glow=True, eyes='focus', **LEG_STRIKE),
       dict(dy=0, tdx=1, armF=(16, 10), armB=(1, 12), pa=-12, glow=True, mouth='open', **LEG_STRIKE),
       dict(dy=0, armF=(13, 14), armB=(3, 16), pa=-78, **LEG_STRIKE)],
     'elias': [
       dict(dy=0, tdx=-1, armF=(12, 8), armB=(4, 14), pa=-105, eyes='focus', **LEG_STRIKE),
       dict(dy=0, tdx=0, armF=(15, 8), armB=(3, 14), pa=-50, big=True, eyes='focus', **LEG_STRIKE),
       dict(dy=0, tdx=1, armF=(16, 10), armB=(2, 14), pa=-8, big=True, mouth='open', **LEG_STRIKE),
       dict(dy=0, armF=(13, 13), armB=(3, 15), pa=-70, **LEG_STRIKE)],
     'mendigo': [
       dict(dy=0, tdx=-1, hdx=-1, armF=(12, 6), armB=(3, 15), pa=-112, eyes='focus', **LEG_STRIKE),
       dict(dy=0, tdx=0, armF=(14, 7), armB=(3, 15), pa=-62, eyes='focus', **LEG_STRIKE),
       dict(dy=0, tdx=1, hdx=1, armF=(16, 11), armB=(2, 15), pa=22, mouth='open', legB=(-3, 0), legF=(3, 0)),
       dict(dy=0, tdx=1, armF=(14, 14), armB=(3, 16), pa=72, **LEG_STRIKE)],
    }
    A['moises'] = A['paulo']; A['gideao'] = A['elias']; A['pedro'] = A['mendigo']
    return A[name]
def hurt_pose():
    return dict(dy=0, tdx=-1, hdx=-1, armB=(1, 11), armF=(14, 11), eyes='hurt', mouth='open', legB=(-3, 0), legF=(1, 0), pa=-128, sling=(120, 3, False), sway=-1)
def dash_poses():
    return [
      dict(dy=1, tdx=1, hdx=1, armB=(2, 14), armF=(9, 16), legB=(-4, 0), legF=(3, 0), eyes='focus', sway=-1, pa=-172, sling=(180, 4, False)),
      dict(dy=1, tdx=1, hdx=1, armB=(1, 13), armF=(8, 15), legB=(-5, 1), legF=(4, 1), eyes='focus', sway=-1, pa=-176, sling=(180, 4, False)),
    ]
